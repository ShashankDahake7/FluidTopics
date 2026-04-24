const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const Document = require('../models/Document');
const Topic = require('../models/Topic');
const User = require('../models/User');

const router = express.Router();

// GET /api/admin/stats — Admin overview statistics
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
      topics: topicCount,
      users: userCount,
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

// GET /api/admin/users — List all users
router.get('/users', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select('name email role isActive lastLogin createdAt')
      .lean();

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/role — Update user role
router.patch('/users/:id/role', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
