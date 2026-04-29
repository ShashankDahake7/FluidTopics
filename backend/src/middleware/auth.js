const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');

// Decode the bearer token, look up the user, and (if the token references a
// session) verify the session is still active. Sets `req.user` and, when
// applicable, `req.actor` (the admin behind an impersonation) and `req.session`.
const auth = async (req, res, next) => {
  try {
    // If the API-key middleware already authenticated this request, skip JWT.
    if (req.user && req.apiKey) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token or user deactivated.' });
    }

    // If the JWT carries a session id, the session row is the source of truth
    // for revocation — even if the JWT is otherwise valid.
    if (decoded.sid) {
      const Session = require('../models/Session');
      const session = await Session.findById(decoded.sid);
      if (!session || session.revokedAt) {
        return res.status(401).json({ error: 'Session revoked.' });
      }
      req.session = session;
      session.lastUsedAt = new Date();
      session.save().catch(() => {});
    }

    // Impersonation — the JWT carries the original admin's id in `actor`.
    if (decoded.actor) {
      req.actor = await User.findById(decoded.actor).lean();
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    next(error);
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    // Super administrators may call any role-gated admin/editor route.
    if (req.user.role === 'superadmin') {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
};

// Optional auth — sets req.user if token present but doesn't reject
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = await User.findById(decoded.id);
    }
  } catch (e) {
    // Ignore auth errors for optional auth
  }
  next();
};

module.exports = { auth, requireRole, optionalAuth };
