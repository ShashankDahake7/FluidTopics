const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');
const { auth, requireTierOrAdminRoles } = require('../middleware/auth');
const { USERS: AR_USERS } = require('../constants/adminRoles');

const router = express.Router();

// Same gate as /api/admin/users — superadmin or USERS_ADMIN only.
router.use(auth, requireTierOrAdminRoles([], AR_USERS));

// GET /api/groups — list all groups + member counts.
router.get('/', async (req, res, next) => {
  try {
    const groups = await Group.find().sort({ name: 1 }).lean();
    const counts = await User.aggregate([
      { $unwind: '$groups' },
      { $group: { _id: '$groups', count: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.count]));
    res.json({
      groups: groups.map((g) => ({ ...g, memberCount: byId.get(String(g._id)) || 0 })),
    });
  } catch (err) { next(err); }
});

// POST /api/groups — create a group.
router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
    const g = await Group.create({ name: name.trim(), description: (description || '').trim() });
    res.status(201).json({ group: g });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Group already exists' });
    next(err);
  }
});

// GET /api/groups/:id — single group + members.
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const group = await Group.findById(req.params.id).lean();
    if (!group) return res.status(404).json({ error: 'Not found' });
    const members = await User.find({ groups: group._id })
      .select('name email role isActive').lean();
    res.json({ group, members });
  } catch (err) { next(err); }
});

// PATCH /api/groups/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const update = {};
    if (typeof req.body.name === 'string') update.name = req.body.name.trim();
    if (typeof req.body.description === 'string') update.description = req.body.description.trim();
    const g = await Group.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!g) return res.status(404).json({ error: 'Not found' });
    res.json({ group: g });
  } catch (err) { next(err); }
});

// DELETE /api/groups/:id — also strips the group from every user's memberships.
router.delete('/:id', async (req, res, next) => {
  try {
    const g = await Group.findByIdAndDelete(req.params.id);
    if (!g) return res.status(404).json({ error: 'Not found' });
    await User.updateMany({ groups: g._id }, { $pull: { groups: g._id } });
    res.json({ message: 'Group deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
