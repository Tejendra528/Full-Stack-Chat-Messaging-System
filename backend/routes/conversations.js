const express = require('express');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(apiLimiter);
router.use(auth);

// Get or create direct conversation with another user
router.get('/direct/:userId', async (req, res) => {
  try {
    const otherId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    if (otherId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot chat with yourself.' });
    }

    let conv = await Conversation.findOne({
      type: 'direct',
      'participants.user': { $all: [req.user._id, otherId] },
      $expr: { $eq: [{ $size: '$participants' }, 2] },
    })
      .populate('participants.user', 'name email avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        select: 'content type createdAt status sender',
        populate: { path: 'sender', select: 'name' },
      })
      .lean();

    if (!conv) {
      conv = await Conversation.create({
        type: 'direct',
        participants: [
          { user: req.user._id, role: 'member' },
          { user: otherId, role: 'member' },
        ],
      });
      conv = await Conversation.findById(conv._id)
        .populate('participants.user', 'name email avatar isOnline lastSeen')
        .populate('lastMessage')
        .lean();
    }

    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get conversation.' });
  }
});

// Create a group conversation (current user becomes admin)
router.post('/', async (req, res) => {
  try {
    const { name, participantIds } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ error: 'Group name must be at least 3 characters.' });
    }
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'At least one participant is required.' });
    }

    const uniqueIds = Array.from(new Set(participantIds.map(String)));
    if (!uniqueIds.includes(req.user._id.toString())) {
      uniqueIds.push(req.user._id.toString());
    }

    if (uniqueIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: 'Invalid participant ID.' });
    }

    const participants = uniqueIds.map((id) => ({
      user: id,
      role: id === req.user._id.toString() ? 'admin' : 'member',
    }));

    const conv = await Conversation.create({
      type: 'group',
      participants,
      name: name.trim(),
    });

    const populated = await Conversation.findById(conv._id)
      .populate('participants.user', 'name email avatar isOnline lastSeen')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group.' });
  }
});

// List my conversations (safe query: only where current user is participant)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const showArchived = req.query.archived === 'true';

    const convos = await Conversation.find({
      'participants.user': req.user._id,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('participants.user', 'name email avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        select: 'content type createdAt status sender',
        populate: { path: 'sender', select: 'name' },
      })
      .lean();

    const total = await Conversation.countDocuments({
      'participants.user': req.user._id,
    });

    // Compute pinned/archived flags per-user and filter/sort in memory
    const enhanced = convos
      .map((c) => {
        const me = c.participants.find(
          (p) => p.user && p.user._id.toString() === req.user._id.toString()
        );
        return {
          ...c,
          _me: {
            isPinned: me?.isPinned || false,
            isArchived: me?.isArchived || false,
          },
        };
      })
      .filter((c) => showArchived ? c._me.isArchived : !c._me.isArchived)
      .sort((a, b) => {
        if (a._me.isPinned && !b._me.isPinned) return -1;
        if (!a._me.isPinned && b._me.isPinned) return 1;
        return (b.lastMessageAt || b.updatedAt) - (a.lastMessageAt || a.updatedAt);
      })
      .map(({ _me, ...rest }) => rest);

    res.json({
      conversations: enhanced,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list conversations.' });
  }
});

// Pin/unpin a conversation for the current user
router.patch('/:id/pin', async (req, res) => {
  try {
    const id = req.params.id;
    const { pinned } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID.' });
    }

    const conv = await Conversation.findOneAndUpdate(
      { _id: id, 'participants.user': req.user._id },
      { $set: { 'participants.$.isPinned': !!pinned } },
      { new: true }
    )
      .populate('participants.user', 'name email avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        select: 'content type createdAt status sender',
        populate: { path: 'sender', select: 'name' },
      })
      .lean();

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pin state.' });
  }
});

// Archive/unarchive a conversation for the current user
router.patch('/:id/archive', async (req, res) => {
  try {
    const id = req.params.id;
    const { archived } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID.' });
    }

    const conv = await Conversation.findOneAndUpdate(
      { _id: id, 'participants.user': req.user._id },
      { $set: { 'participants.$.isArchived': !!archived } },
      { new: true }
    )
      .populate('participants.user', 'name email avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        select: 'content type createdAt status sender',
        populate: { path: 'sender', select: 'name' },
      })
      .lean();

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update archive state.' });
  }
});

// Delete a conversation (hard delete). For groups, only admins can delete.
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID.' });
    }

    const conv = await Conversation.findOne({
      _id: id,
      'participants.user': req.user._id,
    }).lean();

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (conv.type === 'group') {
      const me = conv.participants.find(
        (p) => p.user && p.user.toString() === req.user._id.toString()
      );
      if (!me || me.role !== 'admin') {
        return res.status(403).json({ error: 'Only group admins can delete this group.' });
      }
    }

    await Message.deleteMany({ conversation: id });
    await Conversation.deleteOne({ _id: id });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete conversation.' });
  }
});

// Get single conversation by ID (only if participant)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID.' });
    }

    const conv = await Conversation.findOne({
      _id: id,
      'participants.user': req.user._id,
    })
      .populate('participants.user', 'name email avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        select: 'content type createdAt status sender',
        populate: { path: 'sender', select: 'name' },
      })
      .lean();

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get conversation.' });
  }
});

module.exports = router;
