const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const Document = require('../models/Document');
const Topic    = require('../models/Topic');
const User     = require('../models/User');

const router = express.Router();

const VALID_PERMISSIONS = [
  'PRINT_USER', 'RATING_USER', 'FEEDBACK_USER',
  'GENERATIVE_AI_USER', 'GENERATIVE_AI_EXPORT_USER',
  'PERSONAL_BOOK_USER', 'PERSONAL_BOOK_SHARE_USER',
  'HTML_EXPORT_USER', 'PDF_EXPORT_USER',
  'SAVED_SEARCH_USER', 'COLLECTION_USER',
  'OFFLINE_USER', 'ANALYTICS_USER',
  'BETA_USER', 'DEBUG_USER',
];

// GET /api/admin/stats
router.get('/stats', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const [docCount, topicCount, userCount, recentDocs] = await Promise.all([
      Document.countDocuments(),
      Topic.countDocuments(),
      User.countDocuments(),
      Document.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title status sourceFormat topicIds createdAt')
        .lean(),
    ]);

    const docsByStatus = await Document.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.json({
      documents: docCount,
      topics:    topicCount,
      users:     userCount,
      recentDocuments: recentDocs.map((d) => ({
        ...d,
        topicCount: d.topicIds?.length || 0,
      })),
      documentsByStatus: Object.fromEntries(docsByStatus.map((d) => [d._id, d.count])),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users — list all users with permissions
router.get('/users', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select('name email role permissions isActive lastLogin createdAt')
      .lean();

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users — create a user directly
router.post('/users', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const perms = (permissions || []).filter((p) => VALID_PERMISSIONS.includes(p));
    const user = await User.create({
      name,
      email,
      password,
      role:        ['admin', 'editor', 'viewer'].includes(role) ? role : 'viewer',
      permissions: perms,
    });

    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id — update user (role, permissions, isActive, name)
router.patch('/users/:id', auth, requireRole('admin'), async (req, res, next) => {
  try {
    // Guard: admin cannot change their own role
    if (req.user._id.toString() === req.params.id && req.body.role && req.body.role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const updates = {};
    if (req.body.name        !== undefined) updates.name        = req.body.name;
    if (req.body.email       !== undefined) updates.email       = req.body.email;
    if (req.body.isActive    !== undefined) updates.isActive    = req.body.isActive;
    if (req.body.role        !== undefined) {
      if (!['admin', 'editor', 'viewer'].includes(req.body.role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.role = req.body.role;
    }
    if (req.body.permissions !== undefined) {
      updates.permissions = (req.body.permissions || []).filter((p) => VALID_PERMISSIONS.includes(p));
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/role — legacy single-field role update
router.patch('/users/:id/role', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:id — remove a user
router.delete('/users/:id', auth, requireRole('admin'), async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
