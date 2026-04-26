const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'viewer',
    });

    const token = jwt.sign({ id: user._id }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.status(201).json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password — change the signed-in user's password
router.post('/change-password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    user.password = newPassword; // pre-save hook hashes
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
