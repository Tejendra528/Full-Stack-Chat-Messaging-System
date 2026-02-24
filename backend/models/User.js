const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    avatar: {
      type: String,
      default: null,
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    // 🔥 For future logout-all functionality
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

/* ===========================================
   📌 Indexes
=========================================== */

// Email unique index

// Text search index (for searching users)
userSchema.index({ name: 'text', email: 'text' });

module.exports = mongoose.model('User', userSchema);