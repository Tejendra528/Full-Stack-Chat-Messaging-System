const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const userSockets = new Map(); // userId -> Set(socketIds)
const socketToUser = new Map(); // socketId -> userId

function setupSocket(io) {

  // 🔐 JWT Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.userId)
        .select('_id name');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.userName = user.name;

      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Store socket mapping
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    socketToUser.set(socket.id, userId);

    // 🔵 Online Status
    const now = new Date();
    User.updateOne(
      { _id: userId },
      { isOnline: true, lastSeen: now }
    ).catch(() => {});

    socket.broadcast.emit('user_status', {
      userId,
      isOnline: true,
      lastSeen: now.toISOString(),
    });

    socket.join(`user:${userId}`);

    // -------------------------------
    // 📌 Join / Leave Conversation
    // -------------------------------
    socket.on('join_conversation', (conversationId) => {
      if (conversationId) {
        socket.join(`conv:${conversationId}`);
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conv:${conversationId}`);
      }
    });

    // -------------------------------
    // ✍️ Typing Indicator
    // -------------------------------
    socket.on('typing_start', async ({ conversationId }) => {
      if (!conversationId) return;

      const isParticipant = await Conversation.exists({
        _id: conversationId,
        'participants.user': socket.userId,
      });

      if (!isParticipant) return;

      socket.to(`conv:${conversationId}`).emit('typing', {
        conversationId,
        userId: socket.userId,
        userName: socket.userName,
      });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      if (!conversationId) return;

      socket.to(`conv:${conversationId}`).emit('typing_stopped', {
        conversationId,
        userId: socket.userId,
      });
    });

    // -------------------------------
    // 💬 Send Message
    // -------------------------------
    socket.on('send_message', async (payload, ack) => {
      try {
        const { conversationId, content, type = 'text' } = payload || {};

        if (!conversationId || (!content && type === 'text')) {
          return ack?.({ error: 'conversationId and content required' });
        }

        const conv = await Conversation.findOne({
          _id: conversationId,
          'participants.user': socket.userId,
        }).select('participants');

        if (!conv) {
          return ack?.({ error: 'Conversation not found' });
        }

        // Create message
        const msg = await Message.create({
          conversation: conversationId,
          sender: socket.userId,
          content: (content || '').trim(),
          type,
          status: 'sent',
          deliveredTo: [],
          seenBy: [],
        });

        // Update conversation metadata
        await Conversation.updateOne(
          { _id: conversationId },
          { lastMessage: msg._id, lastMessageAt: msg.createdAt }
        );

        const populated = await Message.findById(msg._id)
          .populate('sender', 'name avatar')
          .lean();

        // Emit message
        io.to(`conv:${conversationId}`).emit('new_message', populated);

        // -------------------------------
        // 📦 Delivered Logic
        // -------------------------------
        const otherUsers = conv.participants
          .map(p => p.user.toString())
          .filter(id => id !== socket.userId);

        let delivered = false;

        for (const uid of otherUsers) {
          if (userSockets.has(uid)) {
            delivered = true;
            await Message.updateOne(
              { _id: msg._id },
              {
                $addToSet: { deliveredTo: uid },
                $set: { status: 'delivered' },
              }
            );
          }
        }

        if (delivered) {
          socket.emit('message_delivered', {
            messageId: msg._id,
            conversationId,
            status: 'delivered',
          });
        }

        // 🔔 In-app notification
        for (const uid of otherUsers) {
          io.to(`user:${uid}`).emit('new_message_notification', {
            conversationId,
            message: {
              ...populated,
              status: delivered ? 'delivered' : 'sent',
            },
          });
        }

        ack?.({
          message: {
            ...populated,
            status: delivered ? 'delivered' : 'sent',
          },
        });

      } catch (err) {
        ack?.({ error: 'Failed to send message' });
      }
    });

    // -------------------------------
    // 👁 Mark Seen
    // -------------------------------
    socket.on('mark_seen', async ({ conversationId }) => {
      if (!conversationId) return;

      try {
        const isParticipant = await Conversation.exists({
          _id: conversationId,
          'participants.user': socket.userId,
        });

        if (!isParticipant) return;

        const result = await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: socket.userId },
            seenBy: { $ne: socket.userId },
          },
          {
            $addToSet: { seenBy: socket.userId },
            $set: { status: 'seen' },
          }
        );

        if (result.modifiedCount > 0) {
          io.to(`conv:${conversationId}`).emit('messages_seen', {
            conversationId,
            seenBy: socket.userId,
          });
        }
      } catch (err) {
        console.error('mark_seen error', err);
      }
    });

    // -------------------------------
    // ❌ Disconnect
    // -------------------------------
    socket.on('disconnect', () => {
      userSockets.get(userId)?.delete(socket.id);

      if (userSockets.get(userId)?.size === 0) {
        userSockets.delete(userId);
      }

      socketToUser.delete(socket.id);

      const now = new Date();
      const isOnline = userSockets.has(userId);

      User.updateOne(
        { _id: userId },
        { isOnline, lastSeen: now }
      ).catch(() => {});

      socket.broadcast.emit('user_status', {
        userId,
        isOnline,
        lastSeen: now.toISOString(),
      });
    });
  });

  return { userSockets, socketToUser };
}

module.exports = { setupSocket, userSockets, socketToUser };