const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    role: {
      type: String,
      enum: ['member', 'admin'],
      default: 'member',
    },

    lastReadAt: {
      type: Date,
      default: null,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct',
    },

    participants: {
      type: [participantSchema],
      validate: {
        validator: function (value) {
          if (this.type === 'direct') return value.length === 2;
          if (this.type === 'group') return value.length >= 2;
          return false;
        },
        message: 'Invalid number of participants.',
      },
    },

    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    image: {
      type: String,
      default: null,
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },

    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },

    // 🔥 Soft delete support
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/* =============================
   INDEXES
============================= */

// Efficient conversation list queries
conversationSchema.index({ 'participants.user': 1, lastMessageAt: -1 });

// Prevent duplicate direct conversations
conversationSchema.index(
  { type: 1, 'participants.user': 1 },
  { partialFilterExpression: { type: 'direct' } }
);

module.exports = mongoose.model('Conversation', conversationSchema);