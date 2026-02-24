const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');

const User = require('../models/User');
const auth = require('../middleware/auth');
const validate = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/* =====================================================
   📌 REGISTER
===================================================== */

router.post(
  '/register',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required'),

    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),

    body('name')
      .trim()
      .notEmpty()
      .isLength({ max: 50 })
      .withMessage('Name required (max 50 chars)'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password, name } = req.body;

      // Check if email already exists
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({
          error: 'Email already registered.',
        });
      }

      // Hash password
      const hashed = await bcrypt.hash(password, 12);

      const user = await User.create({
        email,
        password: hashed,
        name,
        tokenVersion: 0, // for future logout-all
      });

      const token = jwt.sign(
        { userId: user._id, tokenVersion: user.tokenVersion },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const safeUser = user.toObject();
      delete safeUser.password;

      res.status(201).json({
        user: safeUser,
        token,
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({
        error: 'Registration failed.',
      });
    }
  }
);

/* =====================================================
   🔐 LOGIN
===================================================== */

router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required'),

    body('password')
      .notEmpty()
      .withMessage('Password required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        return res.status(401).json({
          error: 'Invalid email or password.',
        });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({
          error: 'Invalid email or password.',
        });
      }

      // Update last login timestamp
      user.lastLoginAt = new Date();
      await user.save();

      const token = jwt.sign(
        { userId: user._id, tokenVersion: user.tokenVersion || 0 },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const safeUser = user.toObject();
      delete safeUser.password;

      res.json({
        user: safeUser,
        token,
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({
        error: 'Login failed.',
      });
    }
  }
);

/* =====================================================
   👤 GET CURRENT USER
===================================================== */

router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;