const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    content: {
      type: String,
      trim: true,
      default: '',
      maxlength: 5000,
    },

    type: {
      type: String,
      enum: ['text', 'image', 'voice', 'file'],
      default: 'text',
    },

    attachment: {
      url: { type: String },
      filename: { type: String },
      mimeType: { type: String },
      size: { type: Number },
    },

    status: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent',
      index: true,
    },

    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // 🔥 Soft delete support (future feature)
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/* =====================================================
   📌 INDEXES
===================================================== */

// Fast pagination inside conversation
messageSchema.index({ conversation: 1, createdAt: -1 });

// For filtering by status
messageSchema.index({ conversation: 1, status: 1 });

// Text search support (bonus feature)
messageSchema.index({ content: 'text' });

/* =====================================================
   📌 Prevent empty text messages
===================================================== */

messageSchema.pre('validate', function (next) {
  if (this.type === 'text' && !this.content.trim()) {
    return next(new Error('Text message cannot be empty.'));
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);