const express = require('express');
const mongoose = require('mongoose');

const { auth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Group = require('../models/Group');
const Bookmark = require('../models/Bookmark');
const SavedSearch = require('../models/SavedSearch');
const PersonalBook = require('../models/PersonalBook');
const Collection = require('../models/Collection');
const AuditLog = require('../models/AuditLog');
const DefaultRolesConfig = require('../models/DefaultRolesConfig');
const { writeAudit, diffContext } = require('../services/users/auditService');
const vocab = require('../services/users/rolesVocabulary');

const router = express.Router();

// -----------------------------------------------------------------------------
// Authorization
// -----------------------------------------------------------------------------
//
// `requireRole('superadmin')` is the existing tier gate. We additionally allow
// any user that holds the `USERS_ADMIN` administrative role. The `auth`
// middleware has already populated req.user from JWT so we can read it here.

function requireUsersAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (req.user.role === 'superadmin') return next();
  const adminRoles = req.user.adminRoles || [];
  if (adminRoles.includes('USERS_ADMIN')) return next();
  return res.status(403).json({ error: 'Insufficient permissions.' });
}

const ASSIGNABLE_TIERS = ['viewer', 'editor', 'admin', 'superadmin'];

// Common projection — surfaces all origin arrays + lock state so the table can
// render coloured chips without an extra round-trip.
const LIST_PROJECTION = [
  'name email role realm avatar',
  'permissions permissionsManual permissionsAuto permissionsDefault',
  'adminRoles adminRolesManual adminRolesAuto',
  'groups groupsManual groupsAuto',
  'tags tagsManual tagsAuto',
  'isActive lockedManually lockedManuallyAt lockedUntil',
  'emailVerified ssoProvider',
  'lastLogin lastActivityAt',
  'mfa',
  'createdAt updatedAt',
].join(' ');

// Convert a populated/lean user into a wire-friendly object that exposes
// per-dimension origin info. Keeps `permissions`/`groups`/`tags` (effective
// union) for back-compat consumers.
function serialiseUser(u, { withCounts = null } = {}) {
  if (!u) return null;
  const groups = (u.groups || []).map((g) =>
    g && g._id ? { _id: g._id, name: g.name } : { _id: g, name: '' }
  );
  const groupOrigin = (id) => {
    const sId = id?.toString?.() || String(id);
    if ((u.groupsAuto || []).some((x) => x?.toString?.() === sId)) return 'auto';
    if ((u.groupsManual || []).some((x) => x?.toString?.() === sId)) return 'manual';
    return 'manual'; // safe default for legacy rows that have no origin arrays
  };
  const groupsWithOrigin = groups.map((g) => ({ ...g, origin: groupOrigin(g._id) }));

  const tagOrigin = (t) => {
    if ((u.tagsAuto || []).includes(t)) return 'auto';
    if ((u.tagsManual || []).includes(t)) return 'manual';
    return 'manual';
  };
  const tagsWithOrigin = (u.tags || []).map((t) => ({ value: t, origin: tagOrigin(t) }));

  const permOrigin = (p) => {
    if ((u.permissionsAuto || []).includes(p)) return 'auto';
    if ((u.permissionsManual || []).includes(p)) return 'manual';
    if ((u.permissionsDefault || []).includes(p)) return 'default';
    return 'manual';
  };
  const featureRolesWithOrigin = (u.permissions || []).map((p) => ({ value: p, origin: permOrigin(p) }));

  const adminRoleOrigin = (p) => {
    if ((u.adminRolesAuto || []).includes(p)) return 'auto';
    if ((u.adminRolesManual || []).includes(p)) return 'manual';
    return 'manual';
  };
  const adminRolesWithOrigin = (u.adminRoles || []).map((p) => ({ value: p, origin: adminRoleOrigin(p) }));

  const out = {
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    realm: u.realm || 'internal',
    avatar: u.avatar || '',
    isActive: u.isActive !== false,
    locked: !!u.lockedManually,
    lockedManually: !!u.lockedManually,
    lockedManuallyAt: u.lockedManuallyAt || null,
    lockedUntil: u.lockedUntil || null,
    emailVerified: !!u.emailVerified,
    ssoProvider: u.ssoProvider || null,
    lastLogin: u.lastLogin || null,
    lastActivityAt: u.lastActivityAt || u.lastLogin || null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    mfa: {
      enrolled:            !!(u.mfa && u.mfa.enrolled),
      enrolledAt:          u.mfa?.enrolledAt || null,
      graceStartedAt:      u.mfa?.graceStartedAt || null,
      resetRequested:      !!(u.mfa && u.mfa.resetRequested),
      resetTokenExpiresAt: u.mfa?.resetTokenExpiresAt || null,
      resetCount:          u.mfa?.resetCount || 0,
    },
    // Effective union arrays — keep for back-compat
    permissions: u.permissions || [],
    adminRoles:  u.adminRoles  || [],
    groups,
    tags: u.tags || [],
    // Per-origin arrays (raw)
    permissionsManual:  u.permissionsManual  || [],
    permissionsAuto:    u.permissionsAuto    || [],
    permissionsDefault: u.permissionsDefault || [],
    adminRolesManual:   u.adminRolesManual   || [],
    adminRolesAuto:     u.adminRolesAuto     || [],
    groupsManual:       (u.groupsManual || []).map((g) => g?._id || g),
    groupsAuto:         (u.groupsAuto   || []).map((g) => g?._id || g),
    tagsManual:         u.tagsManual    || [],
    tagsAuto:           u.tagsAuto      || [],
    // Per-chip origin annotations (convenience for the table)
    groupsWithOrigin,
    tagsWithOrigin,
    featureRolesWithOrigin,
    adminRolesWithOrigin,
  };

  if (withCounts) Object.assign(out, withCounts);
  return out;
}

// -----------------------------------------------------------------------------
// LIST  GET /api/admin/users
// -----------------------------------------------------------------------------
//
// Server-side filtering for the Manage Users table.
//   q       — name / email / id substring (regex, case-insensitive)
//   realm   — internal | sso | ldap | oidc
//   group   — Group ObjectId or name
//   role    — matches user.role OR feature permission OR admin role
//   tag     — string (effective tag)
//   origin  — auto | manual | default — at least one chip must be that origin
//   page, limit
router.get('/users', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const {
      q, realm, group, role, tag, origin,
      page = 1, limit = 50,
      sort = '-createdAt',
    } = req.query;

    const filter = {};
    if (q) {
      const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      const ors = [{ name: rx }, { email: rx }];
      if (mongoose.isValidObjectId(q)) ors.push({ _id: q });
      filter.$or = ors;
    }
    if (realm) filter.realm = realm;

    if (group) {
      if (mongoose.isValidObjectId(group)) {
        filter.groups = group;
      } else {
        const matched = await Group.find({ name: group }).select('_id').lean();
        filter.groups = { $in: matched.map((g) => g._id) };
      }
    }

    if (role) {
      const r = String(role).trim();
      if (ASSIGNABLE_TIERS.includes(r)) {
        filter.role = r;
      } else {
        const ors = [
          { permissions: r },
          { adminRoles:  r },
        ];
        filter.$and = (filter.$and || []).concat([{ $or: ors }]);
      }
    }

    if (tag) filter.tags = tag;

    if (origin) {
      const o = String(origin).toLowerCase();
      const orsBy = (o === 'auto')
        ? [{ groupsAuto:    { $not: { $size: 0 } } },
           { permissionsAuto:{ $not: { $size: 0 } } },
           { adminRolesAuto: { $not: { $size: 0 } } },
           { tagsAuto:       { $not: { $size: 0 } } }]
        : (o === 'default')
        ? [{ permissionsDefault: { $not: { $size: 0 } } }]
        : (o === 'manual')
        ? [{ groupsManual:    { $not: { $size: 0 } } },
           { permissionsManual:{ $not: { $size: 0 } } },
           { adminRolesManual: { $not: { $size: 0 } } },
           { tagsManual:       { $not: { $size: 0 } } }]
        : null;
      if (orsBy) filter.$and = (filter.$and || []).concat([{ $or: orsBy }]);
    }

    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const pg  = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pg - 1) * lim;

    const [rows, total] = await Promise.all([
      User.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(lim)
        .select(LIST_PROJECTION)
        .populate('groups',       'name')
        .populate('groupsManual', 'name')
        .populate('groupsAuto',   'name')
        .lean(),
      User.countDocuments(filter),
    ]);

    // Asset counts — one aggregation per collection; cheap because it's
    // bounded to the current page. Skipped if the page is empty.
    let countsById = {};
    if (rows.length) {
      const ids = rows.map((r) => r._id);
      const [bm, ss, pb, col] = await Promise.all([
        Bookmark.aggregate([{ $match: { userId: { $in: ids } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
        SavedSearch.aggregate([{ $match: { userId: { $in: ids } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
        PersonalBook.aggregate([{ $match: { userId: { $in: ids } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
        Collection.aggregate([{ $match: { userId: { $in: ids } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
      ]);
      const idx = (arr) => Object.fromEntries(arr.map((r) => [r._id.toString(), r.n]));
      const ix = { bm: idx(bm), ss: idx(ss), pb: idx(pb), col: idx(col) };
      for (const r of rows) {
        const k = r._id.toString();
        countsById[k] = {
          bookmarks:     ix.bm[k]  || 0,
          savedSearches: ix.ss[k]  || 0,
          personalBooks: ix.pb[k]  || 0,
          collections:   ix.col[k] || 0,
        };
      }
    }

    res.json({
      users: rows.map((u) => serialiseUser(u, { withCounts: { counts: countsById[u._id.toString()] || {} } })),
      total,
      page: pg,
      limit: lim,
    });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// DETAIL  GET /api/admin/users/:id
// -----------------------------------------------------------------------------
router.get('/users/:id', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const u = await User.findById(req.params.id)
      .select(LIST_PROJECTION + ' preferences')
      .populate('groups',       'name description')
      .populate('groupsManual', 'name description')
      .populate('groupsAuto',   'name description')
      .populate('preferences.documentIds', 'title slug')
      .populate('preferences.topicIds',    'title slug')
      .populate('preferences.adminSet.documentIds', 'title slug')
      .populate('preferences.adminSet.topicIds',    'title slug')
      .lean();
    if (!u) return res.status(404).json({ error: 'User not found' });

    const [bm, ss, pb, col] = await Promise.all([
      Bookmark.countDocuments({ userId: u._id }),
      SavedSearch.countDocuments({ userId: u._id }),
      PersonalBook.countDocuments({ userId: u._id }),
      Collection.countDocuments({ userId: u._id }),
    ]);

    const result = serialiseUser(u, {
      withCounts: { counts: { bookmarks: bm, savedSearches: ss, personalBooks: pb, collections: col } },
    });
    result.preferences = u.preferences || {};
    res.json({ user: result });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// CREATE  POST /api/admin/users
// -----------------------------------------------------------------------------
router.post('/users', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const {
      name, email, password,
      role, realm,
      permissions, adminRoles,
      groups, tags,
    } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    if (role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only a super administrator can assign that role.' });
    }

    const cleanedFeature = vocab.sanitizeFeatureRoles(permissions || []);
    const cleanedAdmin   = vocab.sanitizeAdminRoles(adminRoles || []);
    const cleanedGroups  = (Array.isArray(groups) ? groups : []).filter((g) => mongoose.isValidObjectId(g));
    const cleanedTags    = (Array.isArray(tags) ? tags : []).map((t) => String(t).trim()).filter(Boolean);

    // Default-role fallback — apply if the admin didn't pick any feature roles.
    let permissionsDefault = [];
    if (cleanedFeature.length === 0) {
      const cfg = await DefaultRolesConfig.getSingleton();
      permissionsDefault = vocab.sanitizeDefaultRoles(cfg.authenticated || []);
    }

    const user = await User.create({
      name,
      email,
      password,
      role: ASSIGNABLE_TIERS.includes(role) ? role : 'viewer',
      realm: ['internal','sso','ldap','oidc'].includes(realm) ? realm : 'internal',
      permissionsManual:  cleanedFeature,
      permissionsDefault,
      adminRolesManual:   cleanedAdmin,
      groupsManual:       cleanedGroups,
      tagsManual:         cleanedTags,
    });

    await writeAudit(req, {
      action: 'user.create',
      targetUserIds: [user._id],
      summary: `Created user ${user.email}`,
      context: {
        role: user.role,
        realm: user.realm,
        featureRoles: cleanedFeature,
        adminRoles: cleanedAdmin,
        groupCount: cleanedGroups.length,
        tagCount: cleanedTags.length,
      },
    });

    const populated = await User.findById(user._id)
      .select(LIST_PROJECTION)
      .populate('groups groupsManual groupsAuto', 'name')
      .lean();
    res.status(201).json({ user: serialiseUser(populated) });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// UPDATE  PATCH /api/admin/users/:id
// -----------------------------------------------------------------------------
//
// Atomic update of common fields. Origin-aware: edits sent here are recorded
// as `*Manual` (admin-curated) and the effective union arrays recompute on
// save. Unknown role / permission ids are silently dropped.
router.patch('/users/:id', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (req.user._id.toString() === req.params.id && req.body.role) {
      const next = req.body.role;
      if (req.user.role === 'admin' && next !== 'admin') {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }
      if (req.user.role === 'superadmin' && !['superadmin', 'admin'].includes(next)) {
        return res.status(400).json({ error: 'Cannot change your own role below admin' });
      }
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const before = target.toObject();
    if (req.body.name !== undefined)     target.name = req.body.name;
    if (req.body.email !== undefined)    target.email = req.body.email;
    if (req.body.realm !== undefined && ['internal','sso','ldap','oidc'].includes(req.body.realm)) {
      target.realm = req.body.realm;
    }
    if (req.body.isActive !== undefined) target.isActive = !!req.body.isActive;
    if (req.body.role !== undefined) {
      if (!ASSIGNABLE_TIERS.includes(req.body.role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      if (req.body.role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only a super administrator can assign that role.' });
      }
      target.role = req.body.role;
    }
    if (Array.isArray(req.body.permissions)) {
      target.permissionsManual = vocab.sanitizeFeatureRoles(req.body.permissions);
    }
    if (Array.isArray(req.body.adminRoles)) {
      target.adminRolesManual = vocab.sanitizeAdminRoles(req.body.adminRoles);
    }
    if (Array.isArray(req.body.groups)) {
      target.groupsManual = req.body.groups.filter((g) => mongoose.isValidObjectId(g));
    }
    if (Array.isArray(req.body.tags)) {
      target.tagsManual = req.body.tags.map((t) => String(t).trim()).filter(Boolean);
    }
    if (req.body.lockedManually !== undefined) {
      const newLock = !!req.body.lockedManually;
      target.lockedManually = newLock;
      target.lockedManuallyAt = newLock ? new Date() : null;
      target.lockedManuallyByUserId = newLock ? req.user._id : null;
    }

    await target.save();

    await writeAudit(req, {
      action: 'user.update',
      targetUserIds: [target._id],
      summary: `Updated user ${target.email}`,
      context: diffContext(before, target.toObject(), [
        'name', 'email', 'role', 'realm', 'isActive',
        'permissionsManual', 'adminRolesManual',
        'groupsManual', 'tagsManual', 'lockedManually',
      ]),
    });

    const fresh = await User.findById(target._id)
      .select(LIST_PROJECTION)
      .populate('groups groupsManual groupsAuto', 'name')
      .lean();
    res.json({ user: serialiseUser(fresh) });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// LOCK  PATCH /api/admin/users/:id/lock
// -----------------------------------------------------------------------------
router.patch('/users/:id/lock', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'Cannot lock your own account' });
    }
    const locked = !!req.body?.locked;
    const u = await User.findByIdAndUpdate(
      req.params.id,
      {
        lockedManually: locked,
        lockedManuallyAt: locked ? new Date() : null,
        lockedManuallyByUserId: locked ? req.user._id : null,
      },
      { new: true }
    )
      .select(LIST_PROJECTION)
      .populate('groups groupsManual groupsAuto', 'name')
      .lean();
    if (!u) return res.status(404).json({ error: 'User not found' });

    await writeAudit(req, {
      action: locked ? 'user.lock' : 'user.unlock',
      targetUserIds: [u._id],
      summary: `${locked ? 'Locked' : 'Unlocked'} user ${u.email}`,
    });

    res.json({ user: serialiseUser(u) });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// SEARCH PREFERENCES (admin-set)
// -----------------------------------------------------------------------------
router.get('/users/:id/search-preferences', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const u = await User.findById(req.params.id)
      .select('preferences')
      .populate('preferences.documentIds preferences.priorityDocumentIds preferences.adminSet.documentIds preferences.adminSet.priorityDocumentIds', 'title slug')
      .populate('preferences.topicIds    preferences.priorityTopicIds    preferences.adminSet.topicIds    preferences.adminSet.priorityTopicIds',    'title slug')
      .lean();
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json({
      userSet:  pickUserSet(u.preferences || {}),
      adminSet: pickAdminSet(u.preferences?.adminSet || {}),
    });
  } catch (err) { next(err); }
});

router.put('/users/:id/search-preferences', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const body = req.body || {};
    const set  = (k, fallback) => Array.isArray(body[k]) ? body[k].filter((x) => mongoose.isValidObjectId(x)) : fallback;
    const before = target.toObject();
    target.preferences.adminSet = {
      documentIds:          set('documentIds',         target.preferences?.adminSet?.documentIds || []),
      topicIds:             set('topicIds',            target.preferences?.adminSet?.topicIds || []),
      releaseNotesOnly:     !!body.releaseNotesOnly,
      priorityDocumentIds:  set('priorityDocumentIds', target.preferences?.adminSet?.priorityDocumentIds || []),
      priorityTopicIds:     set('priorityTopicIds',    target.preferences?.adminSet?.priorityTopicIds || []),
      priorityReleaseNotes: !!body.priorityReleaseNotes,
      updatedAt:            new Date(),
      updatedByUserId:      req.user._id,
    };
    target.markModified('preferences.adminSet');
    await target.save();

    await writeAudit(req, {
      action: 'user.search-preferences.update',
      targetUserIds: [target._id],
      summary: `Updated admin-set search preferences for ${target.email}`,
      context: diffContext(before.preferences?.adminSet || {}, target.preferences.adminSet, [
        'documentIds', 'topicIds', 'releaseNotesOnly',
        'priorityDocumentIds', 'priorityTopicIds', 'priorityReleaseNotes',
      ]),
    });

    res.json({
      userSet:  pickUserSet(target.preferences),
      adminSet: pickAdminSet(target.preferences.adminSet),
    });
  } catch (err) { next(err); }
});

function pickUserSet(p = {}) {
  return {
    documentIds: p.documentIds || [],
    topicIds:    p.topicIds || [],
    releaseNotesOnly: !!p.releaseNotesOnly,
    priorityDocumentIds: p.priorityDocumentIds || [],
    priorityTopicIds:    p.priorityTopicIds || [],
    priorityReleaseNotes: !!p.priorityReleaseNotes,
  };
}
function pickAdminSet(a = {}) {
  return {
    documentIds: a.documentIds || [],
    topicIds:    a.topicIds || [],
    releaseNotesOnly: !!a.releaseNotesOnly,
    priorityDocumentIds: a.priorityDocumentIds || [],
    priorityTopicIds:    a.priorityTopicIds || [],
    priorityReleaseNotes: !!a.priorityReleaseNotes,
    updatedAt: a.updatedAt || null,
    updatedByUserId: a.updatedByUserId || null,
  };
}

// -----------------------------------------------------------------------------
// BULK actions
// -----------------------------------------------------------------------------
//
// POST /api/admin/users/bulk-assign
//   body: { userIds: [...], dimension: 'groups'|'tags'|'roles'|'adminRoles', values: [...], op: 'add'|'remove' }
router.post('/users/bulk-assign', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const { userIds = [], dimension, values = [], op = 'add' } = req.body || {};
    const ids = userIds.filter((id) => mongoose.isValidObjectId(id));
    if (!ids.length) return res.status(400).json({ error: 'userIds[] required' });
    if (!['groups', 'tags', 'roles', 'adminRoles'].includes(dimension)) {
      return res.status(400).json({ error: 'Invalid dimension' });
    }
    const isAdd = op !== 'remove';

    let field, cleaned;
    if (dimension === 'groups') {
      field = 'groupsManual';
      cleaned = (values || []).filter((g) => mongoose.isValidObjectId(g));
    } else if (dimension === 'tags') {
      field = 'tagsManual';
      cleaned = (values || []).map((t) => String(t).trim()).filter(Boolean);
    } else if (dimension === 'roles') {
      field = 'permissionsManual';
      cleaned = vocab.sanitizeFeatureRoles(values || []);
    } else {
      field = 'adminRolesManual';
      cleaned = vocab.sanitizeAdminRoles(values || []);
    }

    if (!cleaned.length) return res.status(400).json({ error: 'No valid values supplied' });

    const update = isAdd
      ? { $addToSet: { [field]: { $each: cleaned } } }
      : { $pullAll: { [field]: cleaned } };

    await User.updateMany({ _id: { $in: ids } }, update);

    // We need a save() pass on each to recompute the union arrays via the
    // pre-save hook. Touch updatedAt only.
    const touched = await User.find({ _id: { $in: ids } });
    await Promise.all(touched.map((u) => { u.markModified(field); return u.save(); }));

    await writeAudit(req, {
      action: `users.bulk.${isAdd ? 'add' : 'remove'}-${dimension}`,
      targetUserIds: ids,
      summary: `${isAdd ? 'Added' : 'Removed'} ${cleaned.length} ${dimension} on ${ids.length} users`,
      context: { values: cleaned },
    });

    res.json({ updated: ids.length });
  } catch (err) { next(err); }
});

// POST /api/admin/users/bulk-delete
router.post('/users/bulk-delete', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const { userIds = [] } = req.body || {};
    const ids = userIds
      .filter((id) => mongoose.isValidObjectId(id))
      .filter((id) => id !== req.user._id.toString());
    if (!ids.length) return res.status(400).json({ error: 'userIds[] required (excluding self)' });

    const targets = await User.find({ _id: { $in: ids } }).select('email').lean();
    const result = await User.deleteMany({ _id: { $in: ids } });

    await writeAudit(req, {
      action: 'users.bulk.delete',
      targetUserIds: ids,
      summary: `Deleted ${result.deletedCount} users`,
      context: { emails: targets.map((t) => t.email) },
    });

    res.json({ deleted: result.deletedCount });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// COPY / MERGE
// -----------------------------------------------------------------------------
//
// Items that may be copied/merged:
//   groups, roles (feature), adminRoles, tags,
//   bookmarks, savedSearches, personalBooks, collections.
//
// Direction is encoded by URL path: source → target. Merge additionally
// deletes the source after the copy succeeds.

async function performCopy({ sourceId, targetId, items, deleteSource, actor }) {
  const [source, target] = await Promise.all([
    User.findById(sourceId),
    User.findById(targetId),
  ]);
  if (!source) throw Object.assign(new Error('Source user not found'), { status: 404 });
  if (!target) throw Object.assign(new Error('Target user not found'), { status: 404 });
  if (source._id.equals(target._id)) {
    throw Object.assign(new Error('Source and target must differ'), { status: 400 });
  }

  const want = (k) => items?.[k] !== false; // default copy everything

  if (want('groups')) {
    const merged = uniqueObjectIds([...(target.groupsManual || []), ...(source.groupsManual || [])]);
    target.groupsManual = merged;
  }
  if (want('roles')) {
    const merged = Array.from(new Set([...(target.permissionsManual || []), ...(source.permissionsManual || [])]));
    target.permissionsManual = vocab.sanitizeFeatureRoles(merged);
  }
  if (want('adminRoles')) {
    const merged = Array.from(new Set([...(target.adminRolesManual || []), ...(source.adminRolesManual || [])]));
    target.adminRolesManual = vocab.sanitizeAdminRoles(merged);
  }
  if (want('tags')) {
    const merged = Array.from(new Set([...(target.tagsManual || []), ...(source.tagsManual || [])])).filter(Boolean);
    target.tagsManual = merged;
  }
  await target.save();

  const counts = { bookmarks: 0, savedSearches: 0, personalBooks: 0, collections: 0 };

  if (want('bookmarks')) {
    const rows = await Bookmark.find({ userId: source._id }).lean();
    for (const r of rows) {
      try {
        await Bookmark.updateOne(
          { userId: target._id, topicId: r.topicId },
          {
            $setOnInsert: {
              userId: target._id,
              topicId: r.topicId,
              note: r.note || '',
              folder: r.folder || 'default',
            },
          },
          { upsert: true }
        );
        counts.bookmarks += 1;
      } catch (_) { /* duplicate — already exists on target */ }
    }
  }
  if (want('savedSearches')) {
    const rows = await SavedSearch.find({ userId: source._id }).lean();
    for (const r of rows) {
      delete r._id;
      r.userId = target._id;
      try { await SavedSearch.create(r); counts.savedSearches += 1; } catch (_) {}
    }
  }
  if (want('personalBooks')) {
    const rows = await PersonalBook.find({ userId: source._id }).lean();
    for (const r of rows) {
      delete r._id;
      r.userId = target._id;
      try { await PersonalBook.create(r); counts.personalBooks += 1; } catch (_) {}
    }
  }
  if (want('collections')) {
    const rows = await Collection.find({ userId: source._id }).lean();
    for (const r of rows) {
      delete r._id;
      r.userId = target._id;
      try { await Collection.create(r); counts.collections += 1; } catch (_) {}
    }
  }

  if (deleteSource) {
    // For unselected items in a merge, the BRD says they are *permanently
    // deleted*. We've already copied the selected ones; deleting the source
    // removes its rows for the unselected categories.
    if (!want('bookmarks'))     await Bookmark.deleteMany({ userId: source._id });
    if (!want('savedSearches')) await SavedSearch.deleteMany({ userId: source._id });
    if (!want('personalBooks')) await PersonalBook.deleteMany({ userId: source._id });
    if (!want('collections'))   await Collection.deleteMany({ userId: source._id });
    // Now delete the source assets that were copied as well, plus the user.
    await Promise.all([
      Bookmark.deleteMany({ userId: source._id }),
      SavedSearch.deleteMany({ userId: source._id }),
      PersonalBook.deleteMany({ userId: source._id }),
      Collection.deleteMany({ userId: source._id }),
    ]);
    await User.deleteOne({ _id: source._id });
  }

  return { target, source, counts };
}

function uniqueObjectIds(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    if (!v) continue;
    const k = v.toString();
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
}

router.post('/users/:targetId/copy-from/:sourceId', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const { items = {} } = req.body || {};
    const result = await performCopy({
      sourceId: req.params.sourceId,
      targetId: req.params.targetId,
      items,
      deleteSource: false,
      actor: req.user,
    });
    await writeAudit(req, {
      action: 'user.copy',
      targetUserIds: [result.target._id, result.source._id],
      summary: `Copied profile data from ${result.source.email} → ${result.target.email}`,
      context: { items, copied: result.counts },
    });
    res.json({ ok: true, counts: result.counts });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/users/:targetId/merge-from/:sourceId', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const { items = {} } = req.body || {};
    if (req.user._id.toString() === req.params.sourceId) {
      return res.status(400).json({ error: 'Cannot merge your own account away' });
    }
    const result = await performCopy({
      sourceId: req.params.sourceId,
      targetId: req.params.targetId,
      items,
      deleteSource: true,
      actor: req.user,
    });
    await writeAudit(req, {
      action: 'user.merge',
      targetUserIds: [result.target._id, result.source._id],
      summary: `Merged ${result.source.email} into ${result.target.email}`,
      context: { items, copied: result.counts, sourceDeleted: true },
    });
    res.json({ ok: true, counts: result.counts, sourceDeleted: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// -----------------------------------------------------------------------------
// DELETE  DELETE /api/admin/users/:id
// -----------------------------------------------------------------------------
router.delete('/users/:id', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await writeAudit(req, {
      action: 'user.delete',
      targetUserIds: [user._id],
      summary: `Deleted user ${user.email}`,
    });

    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// Legacy compat: PATCH /:id/role, POST /:id/password, /:id/activate, /:id/deactivate
// -----------------------------------------------------------------------------
router.patch('/users/:id/role', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!ASSIGNABLE_TIERS.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only a super administrator can assign that role.' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await writeAudit(req, {
      action: 'user.role-change',
      targetUserIds: [user._id],
      summary: `Set tier role of ${user.email} to ${role}`,
      context: { role },
    });
    res.json({ user });
  } catch (err) { next(err); }
});

router.post('/users/:id/password', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'newPassword (≥ 6 chars) is required' });
    }
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
    await writeAudit(req, {
      action: 'user.password-reset',
      targetUserIds: [user._id],
      summary: `Reset password for ${user.email}`,
    });
    res.json({ message: 'Password updated' });
  } catch (err) { next(err); }
});

router.post('/users/:id/activate', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await writeAudit(req, {
      action: 'user.activate',
      targetUserIds: [user._id],
      summary: `Activated ${user.email}`,
    });
    res.json({ user });
  } catch (err) { next(err); }
});

router.post('/users/:id/deactivate', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await writeAudit(req, {
      action: 'user.deactivate',
      targetUserIds: [user._id],
      summary: `Deactivated ${user.email}`,
    });
    res.json({ user });
  } catch (err) { next(err); }
});

router.get('/users/:id/groups', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('groups').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ groups: user.groups || [] });
  } catch (err) { next(err); }
});

router.put('/users/:id/groups', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const { groupIds } = req.body || {};
    if (!Array.isArray(groupIds)) return res.status(400).json({ error: 'groupIds[] required' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    target.groupsManual = groupIds.filter((g) => mongoose.isValidObjectId(g));
    await target.save();
    res.json({ groups: target.groups });
  } catch (err) { next(err); }
});

router.get('/users/:id/tags', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('tags').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ tags: user.tags || [] });
  } catch (err) { next(err); }
});

router.put('/users/:id/tags', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const { tags } = req.body || {};
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags[] required' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    target.tagsManual = tags.map((t) => String(t).trim()).filter(Boolean);
    await target.save();
    res.json({ tags: target.tags });
  } catch (err) { next(err); }
});

// Bulk-create from JSON array — kept for API parity.
router.post('/users/bulk', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const { users } = req.body || {};
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'users[] required' });
    }
    const created = [];
    const skipped = [];
    for (const row of users) {
      const { name, email, password, role, permissions, tags, groups, realm } = row || {};
      if (!name || !email || !password) {
        skipped.push({ email: email || '(missing)', reason: 'missing required fields' });
        continue;
      }
      const exists = await User.findOne({ email: email.toLowerCase().trim() });
      if (exists) { skipped.push({ email, reason: 'already exists' }); continue; }
      try {
        if (role === 'superadmin' && req.user.role !== 'superadmin') {
          skipped.push({ email, reason: 'only superadmin may assign superadmin' });
          continue;
        }
        const u = await User.create({
          name, email, password,
          role: ASSIGNABLE_TIERS.includes(role) ? role : 'viewer',
          realm: ['internal','sso','ldap','oidc'].includes(realm) ? realm : 'internal',
          permissionsManual:  vocab.sanitizeFeatureRoles(permissions || []),
          tagsManual:        (tags || []).map((t) => String(t).trim()).filter(Boolean),
          groupsManual:      Array.isArray(groups) ? groups.filter((g) => mongoose.isValidObjectId(g)) : [],
        });
        created.push({ _id: u._id, email: u.email });
      } catch (e) {
        skipped.push({ email, reason: e.message });
      }
    }
    if (created.length) {
      await writeAudit(req, {
        action: 'users.bulk-create',
        targetUserIds: created.map((c) => c._id),
        summary: `Bulk created ${created.length} users (${skipped.length} skipped)`,
      });
    }
    res.status(201).json({
      created, skipped,
      createdCount: created.length, skippedCount: skipped.length,
    });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// DEFAULT ROLES
// -----------------------------------------------------------------------------
router.get('/default-roles', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const cfg = await DefaultRolesConfig.getSingleton();
    res.json({
      unauthenticated: cfg.unauthenticated || [],
      authenticated:   cfg.authenticated || [],
      catalogue: {
        unauthenticated: vocab.FEATURE_ROLES.filter((r) => r.bucket === 'unauthenticated' && r.defaultEligible),
        authenticated:   vocab.FEATURE_ROLES.filter((r) => r.bucket === 'authenticated'   && r.defaultEligible),
      },
      updatedAt: cfg.updatedAt || null,
      updatedByUserId: cfg.updatedByUserId || null,
    });
  } catch (err) { next(err); }
});

router.put('/default-roles', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const cfg = await DefaultRolesConfig.getSingleton();
    const before = { unauthenticated: cfg.unauthenticated || [], authenticated: cfg.authenticated || [] };
    cfg.unauthenticated = vocab.sanitizeDefaultRoles(req.body?.unauthenticated || [], 'unauthenticated');
    cfg.authenticated   = vocab.sanitizeDefaultRoles(req.body?.authenticated   || [], 'authenticated');
    cfg.updatedByUserId = req.user._id;
    await cfg.save();

    await writeAudit(req, {
      action: 'default-roles.update',
      summary: 'Updated default roles',
      context: diffContext(before, cfg, ['unauthenticated', 'authenticated']),
    });

    res.json({
      unauthenticated: cfg.unauthenticated,
      authenticated:   cfg.authenticated,
      updatedAt:       cfg.updatedAt,
      updatedByUserId: cfg.updatedByUserId,
    });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// XLSX EXPORT
// -----------------------------------------------------------------------------
//
// Streams an XLSX of the *current filter set*. exceljs is required lazily so
// the rest of the routes still work if the dependency hasn't been installed
// yet on a given environment.
router.get('/users/export.xlsx', auth, requireUsersAdmin, async (req, res, next) => {
  let ExcelJS;
  try { ExcelJS = require('exceljs'); }
  catch (e) {
    return res.status(503).json({
      error: 'XLSX export is unavailable. Install the `exceljs` dependency on the backend.',
    });
  }
  try {
    // Reuse the same filter parsing as GET /users
    const filter = await buildListFilter(req.query);
    const rows = await User.find(filter)
      .sort('-createdAt')
      .select(LIST_PROJECTION + ' preferences')
      .populate('groups groupsManual groupsAuto', 'name')
      .lean();

    const counts = await Promise.all([
      Bookmark.aggregate([{ $match: { userId: { $in: rows.map((r) => r._id) } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
      SavedSearch.aggregate([{ $match: { userId: { $in: rows.map((r) => r._id) } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
      PersonalBook.aggregate([{ $match: { userId: { $in: rows.map((r) => r._id) } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
      Collection.aggregate([{ $match: { userId: { $in: rows.map((r) => r._id) } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
    ]);
    const ix = (arr) => Object.fromEntries(arr.map((r) => [r._id.toString(), r.n]));
    const cmap = { bm: ix(counts[0]), ss: ix(counts[1]), pb: ix(counts[2]), col: ix(counts[3]) };

    const wb = new ExcelJS.Workbook();
    wb.creator = req.user.email || 'admin';
    wb.created = new Date();
    const ws = wb.addWorksheet('users');

    ws.columns = [
      { header: 'User ID',                  key: 'id',          width: 28 },
      { header: 'Display name',             key: 'name',        width: 26 },
      { header: 'Email',                    key: 'email',       width: 30 },
      { header: 'Creation date',            key: 'createdAt',   width: 22 },
      { header: 'Last login',               key: 'lastLogin',   width: 22 },
      { header: 'Last activity',            key: 'lastActivity',width: 22 },
      { header: 'Account locked',           key: 'locked',      width: 14 },
      { header: 'Realm',                    key: 'realm',       width: 12 },
      { header: 'Tier role',                key: 'tier',        width: 12 },
      { header: 'Feature roles (effective)',key: 'roles',       width: 50 },
      { header: 'Feature roles (manual)',   key: 'rolesManual', width: 50 },
      { header: 'Feature roles (auto)',     key: 'rolesAuto',   width: 40 },
      { header: 'Feature roles (default)',  key: 'rolesDefault',width: 40 },
      { header: 'Admin roles',              key: 'adminRoles',  width: 36 },
      { header: 'Groups (effective)',       key: 'groups',      width: 36 },
      { header: 'Groups (manual)',          key: 'groupsManual',width: 30 },
      { header: 'Groups (auto)',            key: 'groupsAuto',  width: 30 },
      { header: 'Tags (effective)',         key: 'tags',        width: 36 },
      { header: 'Tags (manual)',            key: 'tagsManual',  width: 30 },
      { header: 'Tags (auto)',              key: 'tagsAuto',    width: 30 },
      { header: 'Bookmarks',                key: 'bookmarks',   width: 12 },
      { header: 'Saved searches',           key: 'searches',    width: 14 },
      { header: 'Personal books',           key: 'books',       width: 14 },
      { header: 'Collections',              key: 'collections', width: 14 },
      { header: 'Locale',                   key: 'locale',      width: 10 },
      { header: 'Theme',                    key: 'theme',       width: 10 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const u of rows) {
      const k = u._id.toString();
      ws.addRow({
        id: u._id.toString(),
        name: u.name || '',
        email: u.email || '',
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '',
        lastLogin: u.lastLogin ? new Date(u.lastLogin).toISOString() : '',
        lastActivity: u.lastActivityAt ? new Date(u.lastActivityAt).toISOString() : '',
        locked: u.lockedManually ? 'yes' : 'no',
        realm: u.realm || 'internal',
        tier: u.role || 'viewer',
        roles:        (u.permissions || []).join(', '),
        rolesManual:  (u.permissionsManual || []).join(', '),
        rolesAuto:    (u.permissionsAuto || []).join(', '),
        rolesDefault: (u.permissionsDefault || []).join(', '),
        adminRoles:   (u.adminRoles || []).join(', '),
        groups:        (u.groups || []).map((g) => g.name || g).join(', '),
        groupsManual:  (u.groupsManual || []).map((g) => g.name || g).join(', '),
        groupsAuto:    (u.groupsAuto || []).map((g) => g.name || g).join(', '),
        tags:        (u.tags || []).join(', '),
        tagsManual:  (u.tagsManual || []).join(', '),
        tagsAuto:    (u.tagsAuto || []).join(', '),
        bookmarks:   cmap.bm[k] || 0,
        searches:    cmap.ss[k] || 0,
        books:       cmap.pb[k] || 0,
        collections: cmap.col[k]|| 0,
        locale: u.preferences?.language || '',
        theme:  u.preferences?.theme || '',
      });
    }

    await writeAudit(req, {
      action: 'users.export.xlsx',
      summary: `Downloaded XLSX of ${rows.length} users`,
      context: { filter: req.query },
    });

    const ts = new Date().toISOString().replace(/:/g, '_').replace(/\..+$/, '');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ft-users-${ts}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

async function buildListFilter(query) {
  const { q, realm, group, role, tag, origin } = query || {};
  const filter = {};
  if (q) {
    const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const ors = [{ name: rx }, { email: rx }];
    if (mongoose.isValidObjectId(q)) ors.push({ _id: q });
    filter.$or = ors;
  }
  if (realm) filter.realm = realm;
  if (group) {
    if (mongoose.isValidObjectId(group)) filter.groups = group;
    else {
      const matched = await Group.find({ name: group }).select('_id').lean();
      filter.groups = { $in: matched.map((g) => g._id) };
    }
  }
  if (role) {
    const r = String(role).trim();
    if (ASSIGNABLE_TIERS.includes(r)) filter.role = r;
    else filter.$and = (filter.$and || []).concat([{ $or: [{ permissions: r }, { adminRoles: r }] }]);
  }
  if (tag) filter.tags = tag;
  if (origin) {
    const o = String(origin).toLowerCase();
    if (o === 'auto')   filter.$and = (filter.$and || []).concat([{ $or: [{ groupsAuto: { $not: { $size: 0 } } }, { permissionsAuto: { $not: { $size: 0 } } }, { adminRolesAuto: { $not: { $size: 0 } } }, { tagsAuto: { $not: { $size: 0 } } }] }]);
    if (o === 'manual') filter.$and = (filter.$and || []).concat([{ $or: [{ groupsManual: { $not: { $size: 0 } } }, { permissionsManual: { $not: { $size: 0 } } }, { adminRolesManual: { $not: { $size: 0 } } }, { tagsManual: { $not: { $size: 0 } } }] }]);
    if (o === 'default') filter.$and = (filter.$and || []).concat([{ permissionsDefault: { $not: { $size: 0 } } }]);
  }
  return filter;
}

// -----------------------------------------------------------------------------
// AUDIT LOG
// -----------------------------------------------------------------------------
router.get('/audit-log', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const {
      action, target, actor,
      from, to,
      page = 1, limit = 50,
    } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (target && mongoose.isValidObjectId(target)) filter.targetUserIds = target;
    if (actor  && mongoose.isValidObjectId(actor))  filter.actorId       = actor;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to)   filter.timestamp.$lte = new Date(to);
    }
    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const pg  = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pg - 1) * lim;
    const [rows, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip).limit(lim)
        .populate('actorId',       'name email role')
        .populate('targetUserIds', 'name email')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ rows, total, page: pg, limit: lim });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// Lightweight group catalogue — re-exposes /api/groups data to USERS_ADMIN
// actors that don't hold the admin tier (which `/api/groups` requires).
// -----------------------------------------------------------------------------
router.get('/groups', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const groups = await Group.find().sort({ name: 1 }).select('name description').lean();
    res.json({ groups });
  } catch (err) { next(err); }
});

router.post('/groups', auth, requireUsersAdmin, async (req, res, next) => {
  try {
    const { name, description } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
    const g = await Group.create({
      name: name.trim(),
      description: (description || '').trim(),
    });
    await writeAudit(req, {
      action: 'group.create',
      summary: `Created group ${g.name}`,
      context: { groupId: g._id },
    });
    res.status(201).json({ group: g });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Group already exists' });
    next(err);
  }
});

// -----------------------------------------------------------------------------
// Vocabulary helper — used by the front-end to populate the role pickers.
// -----------------------------------------------------------------------------
router.get('/users-vocabulary', auth, requireUsersAdmin, (req, res) => {
  res.json({
    featureRoles:        vocab.FEATURE_ROLES,
    administrativeRoles: vocab.ADMINISTRATIVE_ROLES,
    realms:              ['internal', 'sso', 'ldap', 'oidc'],
    tiers:               ASSIGNABLE_TIERS,
  });
});

module.exports = router;
