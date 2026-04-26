const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const Document = require('../models/Document');
const Topic    = require('../models/Topic');
const User     = require('../models/User');
const { getElasticClient } = require('../config/elasticsearch');
const { indexTopics } = require('../services/search/indexingService');
const config = require('../config/env');
const SiteConfig = require('../models/SiteConfig');

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

const ASSIGNABLE_ROLES = ['viewer', 'editor', 'admin', 'superadmin'];

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

// GET /api/admin/users — paginated, filterable list.
//   ?q= matches name or email (regex)
//   ?role=admin|editor|viewer
//   ?isActive=true|false
//   ?group=<groupId>
//   ?tag=<tag>
//   ?page= ?limit=
router.get('/users', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { q, role, isActive, group, tag, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    if (role)     filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === '1';
    if (group)    filter.groups = group;
    if (tag)      filter.tags = tag;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .select('name email role permissions isActive lastLogin emailVerified groups tags createdAt')
        .populate('groups', 'name')
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ users, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users/:id — single user (incl. groups + tags).
router.get('/users/:id', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await User.findById(req.params.id)
      .select('name email role permissions isActive lastLogin emailVerified groups tags createdAt updatedAt avatar preferences')
      .populate('groups', 'name description')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users — create a user directly
router.post('/users', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    if (role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only a super administrator can assign that role.' });
    }
    const perms = (permissions || []).filter((p) => VALID_PERMISSIONS.includes(p));
    const user = await User.create({
      name,
      email,
      password,
      role:        ASSIGNABLE_ROLES.includes(role) ? role : 'viewer',
      permissions: perms,
    });

    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id — update user (role, permissions, isActive, name)
router.patch('/users/:id', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    // Guard: cannot demote yourself below your current privilege tier
    if (req.user._id.toString() === req.params.id && req.body.role) {
      const next = req.body.role;
      if (req.user.role === 'admin' && next !== 'admin') {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }
      if (req.user.role === 'superadmin' && !['superadmin', 'admin'].includes(next)) {
        return res.status(400).json({ error: 'Cannot change your own role below admin' });
      }
    }

    const updates = {};
    if (req.body.name        !== undefined) updates.name        = req.body.name;
    if (req.body.email       !== undefined) updates.email       = req.body.email;
    if (req.body.isActive    !== undefined) updates.isActive    = req.body.isActive;
    if (req.body.role        !== undefined) {
      if (!ASSIGNABLE_ROLES.includes(req.body.role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      if (req.body.role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only a super administrator can assign that role.' });
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
router.patch('/users/:id/role', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only a super administrator can assign that role.' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:id — remove a user
router.delete('/users/:id', auth, requireRole('superadmin'), async (req, res, next) => {
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

// POST /api/admin/users/:id/password — admin sets another user's password.
router.post('/users/:id/password', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'newPassword (≥ 6 chars) is required' });
    }
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.password = newPassword; // pre-save hook hashes
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users/:id/activate
router.post('/users/:id/activate', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) { next(error); }
});

// POST /api/admin/users/:id/deactivate
router.post('/users/:id/deactivate', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) { next(error); }
});

// GET / PUT /api/admin/users/:id/groups — get and replace group memberships.
router.get('/users/:id/groups', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('groups').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ groups: user.groups || [] });
  } catch (error) { next(error); }
});

router.put('/users/:id/groups', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { groupIds } = req.body || {};
    if (!Array.isArray(groupIds)) return res.status(400).json({ error: 'groupIds[] required' });
    const user = await User.findByIdAndUpdate(req.params.id, { groups: groupIds }, { new: true })
      .populate('groups').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ groups: user.groups });
  } catch (error) { next(error); }
});

// GET / PUT /api/admin/users/:id/tags
router.get('/users/:id/tags', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('tags').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ tags: user.tags || [] });
  } catch (error) { next(error); }
});

router.put('/users/:id/tags', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { tags } = req.body || {};
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags[] required' });
    const cleaned = tags.map((t) => String(t).trim()).filter(Boolean);
    const user = await User.findByIdAndUpdate(req.params.id, { tags: cleaned }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ tags: user.tags });
  } catch (error) { next(error); }
});

// POST /api/admin/users/bulk — bulk-create from a JSON array.
//   body: { users: [{ name, email, password, role, permissions, tags, groups }] }
router.post('/users/bulk', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { users } = req.body || {};
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'users[] required' });
    }
    const created = [];
    const skipped = [];
    for (const row of users) {
      const { name, email, password, role, permissions, tags, groups } = row || {};
      if (!name || !email || !password) {
        skipped.push({ email: email || '(missing)', reason: 'missing required fields' });
        continue;
      }
      const exists = await User.findOne({ email: email.toLowerCase().trim() });
      if (exists) {
        skipped.push({ email, reason: 'already exists' });
        continue;
      }
      try {
        if (role === 'superadmin' && req.user.role !== 'superadmin') {
          skipped.push({ email, reason: 'only superadmin may assign superadmin' });
          continue;
        }
        const u = await User.create({
          name, email, password,
          role: ASSIGNABLE_ROLES.includes(role) ? role : 'viewer',
          permissions: (permissions || []).filter((p) => VALID_PERMISSIONS.includes(p)),
          tags:   (tags || []).map((t) => String(t).trim()).filter(Boolean),
          groups: Array.isArray(groups) ? groups : [],
        });
        created.push({ _id: u._id, email: u.email });
      } catch (e) {
        skipped.push({ email, reason: e.message });
      }
    }
    res.status(201).json({ created, skipped, createdCount: created.length, skippedCount: skipped.length });
  } catch (error) { next(error); }
});

// POST /api/admin/users/:id/impersonate — issue a short-lived access token
// that authenticates as the target user but carries the admin's id in the
// `actor` claim, so audit / activity attribution can attach to the real
// human behind the request.
router.post('/users/:id/impersonate', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const jwt = require('jsonwebtoken');
    const config = require('../config/env');
    const Session = require('../models/Session');
    const crypto = require('crypto');

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'Cannot impersonate yourself' });
    }
    const target = await User.findById(req.params.id);
    if (!target || !target.isActive) {
      return res.status(404).json({ error: 'Target user not found or deactivated' });
    }
    if (target.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Insufficient permissions to impersonate this account.' });
    }

    // Short-lived (1h) impersonation session. We persist a Session row so
    // logout / revocation works the same way as a normal login.
    const refresh = crypto.randomBytes(32).toString('hex');
    const session = await Session.create({
      userId:    target._id,
      actorId:   req.user._id,
      refreshTokenHash: crypto.createHash('sha256').update(refresh).digest('hex'),
      userAgent: (req.headers['user-agent'] || '').slice(0, 250),
      ip:        req.ip || '',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
    });
    const token = jwt.sign(
      { id: target._id, sid: session._id, actor: req.user._id },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    res.json({ token, refreshToken: refresh, impersonating: { _id: target._id, email: target.email } });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/reindex — wipe + rebuild the Elasticsearch topics index
router.post('/reindex', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const client = getElasticClient();
    await client.deleteByQuery({
      index: config.elasticsearch.index,
      body: { query: { match_all: {} } },
      refresh: true,
    });

    const total = await Topic.countDocuments();
    let processed = 0;
    const cursor = Topic.find({}).lean().cursor();
    let batch = [];
    for await (const t of cursor) {
      batch.push(t);
      if (batch.length >= 250) {
        await indexTopics(batch);
        processed += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await indexTopics(batch);
      processed += batch.length;
    }
    res.json({ message: 'Reindex complete', total, processed });
  } catch (error) {
    next(error);
  }
});

const TranslationProfile = require('../models/TranslationProfile');

// GET /api/admin/translation-profiles — list AI translation profiles
router.get('/translation-profiles', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const profiles = await TranslationProfile.find().sort({ name: 1 }).lean();
    res.json({ profiles });
  } catch (e) { next(e); }
});

// POST /api/admin/translation-profiles — create profile (optionally set as default)
router.post('/translation-profiles', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.name || typeof body.name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    const p = await TranslationProfile.create({
      name: body.name.trim(),
      description: body.description || '',
      provider: body.provider || 'groq',
      model: body.model,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature,
      sourceLanguages: body.sourceLanguages,
      targetLanguages: body.targetLanguages,
      isDefault: !!body.isDefault,
    });
    if (body.isDefault) {
      await TranslationProfile.updateMany({ _id: { $ne: p._id } }, { $set: { isDefault: false } });
    }
    res.status(201).json(p);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// Legal terms (Fluid Topics–style admin)
// ---------------------------------------------------------------------------

function normalizeLegalMessages(raw, defaultLocale) {
  const fb = (defaultLocale || 'en').toLowerCase().split('-')[0];
  let list = Array.isArray(raw) ? raw.map((m) => ({
    locale: String(m.locale || '').toLowerCase().split('-')[0] || fb,
    label: typeof m.label === 'string' ? m.label : '',
    linksHtml: typeof m.linksHtml === 'string' ? m.linksHtml : '',
    validated: !!m.validated,
  })) : [];
  if (!list.some((m) => m.locale === fb)) {
    list = [{ locale: fb, label: '', linksHtml: '', validated: false }, ...list];
  }
  const seen = new Set();
  list = list.filter((m) => {
    if (seen.has(m.locale)) return false;
    seen.add(m.locale);
    return true;
  });
  list.sort((a, b) => (a.locale === fb ? -1 : b.locale === fb ? 1 : a.locale.localeCompare(b.locale)));
  return { list, fallbackLocale: fb };
}

router.get('/legal-terms', auth, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    const defaultLocale = (cfg.defaultLocale || 'en').toLowerCase().split('-')[0];
    const { list, fallbackLocale } = normalizeLegalMessages(cfg.legalTermsMessages, defaultLocale);
    res.json({
      defaultLocale: fallbackLocale,
      enabled: !!cfg.legalTermsEnabled,
      messages: list,
      policyVersion: cfg.legalTermsPolicyVersion || 0,
      lastPolicyUpdateAt: cfg.legalTermsLastPolicyUpdateAt || null,
    });
  } catch (e) {
    next(e);
  }
});

router.put('/legal-terms', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    const defaultLocale = (cfg.defaultLocale || 'en').toLowerCase().split('-')[0];
    const enabled = !!req.body?.enabled;
    const { list } = normalizeLegalMessages(req.body?.messages, defaultLocale);

    if (enabled) {
      const fb = list.find((m) => m.locale === defaultLocale);
      if (!fb || !fb.label?.trim() || !fb.linksHtml?.trim()) {
        return res.status(400).json({
          error: 'You cannot save an invalid configuration. Fallback language message is mandatory.',
        });
      }
      if (!fb.validated) {
        return res.status(400).json({
          error: 'You cannot save an invalid configuration: Fallback language message must be validated.',
        });
      }
    }

    cfg.legalTermsEnabled = enabled;
    cfg.legalTermsMessages = list;
    await cfg.save();
    res.json({
      defaultLocale,
      enabled: cfg.legalTermsEnabled,
      messages: cfg.legalTermsMessages,
      policyVersion: cfg.legalTermsPolicyVersion || 0,
      lastPolicyUpdateAt: cfg.legalTermsLastPolicyUpdateAt || null,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/legal-terms/new-version', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    if (!cfg.legalTermsEnabled) {
      return res.status(400).json({ error: 'Enable legal terms before creating a new version.' });
    }
    cfg.legalTermsPolicyVersion = (cfg.legalTermsPolicyVersion || 0) + 1;
    cfg.legalTermsLastPolicyUpdateAt = new Date();
    await cfg.save();
    res.json({
      policyVersion: cfg.legalTermsPolicyVersion,
      lastPolicyUpdateAt: cfg.legalTermsLastPolicyUpdateAt,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
