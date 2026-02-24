const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Joi = require('joi');

const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(apiLimiter);
router.use(auth);

/* =====================================================
   📌 VALIDATION SCHEMAS
===================================================== */

const paginationSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(30),
  search: Joi.string().allow('').optional(),
});

const markSeenSchema = Joi.object({
  conversationId: Joi.string().required(),
});

const uploadSchema = Joi.object({
  conversationId: Joi.string().required(),
});

/* =====================================================
   📦 MULTER CONFIG
===================================================== */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${base || 'file'}-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* =====================================================
   💬 CHAT HISTORY (PAGINATED + SEARCH)
===================================================== */

router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { page, limit, search } = value;
    const convId = req.params.conversationId;

    if (!mongoose.Types.ObjectId.isValid(convId)) {
      return res.status(400).json({ error: 'Invalid conversation ID.' });
    }

    const isParticipant = await Conversation.exists({
      _id: convId,
      'participants.user': req.user._id,
    });

    if (!isParticipant) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const query = { conversation: convId };

    // 🔍 BONUS: Search inside conversation
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name avatar')
      .lean();

    const total = await Message.countDocuments(query);

    res.json({
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Load messages error:', err);
    res.status(500).json({ error: 'Failed to load messages.' });
  }
});

/* =====================================================
   📎 UPLOAD ATTACHMENT MESSAGE
===================================================== */

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { error } = uploadSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { conversationId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File is required.' });
    }

    const conv = await Conversation.findOne({
      _id: conversationId,
      'participants.user': req.user._id,
    }).select('participants');

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const mime = req.file.mimetype || '';
    let type = 'file';
    if (mime.startsWith('image/')) type = 'image';
    else if (mime.startsWith('audio/')) type = 'voice';

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      content: '',
      type,
      attachment: {
        url: `/uploads/${req.file.filename}`,
        filename: req.file.originalname,
        mimeType: mime,
        size: req.file.size,
      },
      status: 'sent',
      deliveredTo: [],
      seenBy: [],
    });

    await Conversation.updateOne(
      { _id: conversationId },
      { lastMessage: message._id, lastMessageAt: message.createdAt }
    );

    const populated = await Message.findById(message._id)
      .populate('sender', 'name avatar')
      .lean();

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${conversationId}`).emit('new_message', populated);
    }

    res.status(201).json({ message: populated });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload attachment.' });
  }
});

/* =====================================================
   👁 MARK MESSAGES AS SEEN
===================================================== */

router.post('/mark-seen', async (req, res) => {
  try {
    const { error, value } = markSeenSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { conversationId } = value;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID.' });
    }

    const isParticipant = await Conversation.exists({
      _id: conversationId,
      'participants.user': req.user._id,
    });

    if (!isParticipant) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user._id },
        seenBy: { $ne: req.user._id },
      },
      {
        $addToSet: { seenBy: req.user._id },
        $set: { status: 'seen' },
      }
    );

    await Conversation.updateOne(
      { _id: conversationId, 'participants.user': req.user._id },
      { 'participants.$.lastReadAt': new Date() }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Mark seen error:', err);
    res.status(500).json({ error: 'Failed to mark as seen.' });
  }
});

module.exports = router;