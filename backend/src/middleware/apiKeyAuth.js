/**
 * API Key authentication middleware.
 *
 * Checks the Authorization header for a Bearer token that matches a stored
 * API key.  When matched:
 *   - req.apiKey   is set to the ApiKey document
 *   - req.user     is set to a synthetic user object with the key's roles
 *   - lastActivity is updated on the key
 *
 * IP restrictions are enforced when present.
 */
const ApiKey = require('../models/ApiKey');

function ipMatches(clientIp, restrictions) {
  if (!restrictions || !restrictions.trim()) return true;
  const allowed = restrictions.split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true;

  const normalizedClient = clientIp.replace(/^::ffff:/, '');

  return allowed.some(entry => {
    if (entry.includes('/')) {
      // CIDR match
      const [subnet, bits] = entry.split('/');
      const mask = parseInt(bits, 10);
      if (isNaN(mask)) return false;
      return cidrMatch(normalizedClient, subnet, mask);
    }
    return normalizedClient === entry;
  });
}

function cidrMatch(ip, subnet, mask) {
  const ipNum = ipToNum(ip);
  const subnetNum = ipToNum(subnet);
  if (ipNum === null || subnetNum === null) return false;
  const m = (~0 << (32 - mask)) >>> 0;
  return (ipNum & m) === (subnetNum & m);
}

function ipToNum(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const p = parseInt(parts[i], 10);
    if (isNaN(p) || p < 0 || p > 255) return null;
    num = (num << 8) | p;
  }
  return num >>> 0;
}

module.exports = async function apiKeyAuth(req, res, next) {
  // Only activate if no user is already authenticated (JWT takes precedence)
  if (req.user) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  const token = authHeader.split(' ')[1];
  if (!token) return next();

  try {
    const key = await ApiKey.findOne({ secret: token });
    if (!key) return next(); // Not an API key, let normal auth handle it

    // IP restriction check
    const clientIp = req.ip || req.connection?.remoteAddress || '';
    if (!ipMatches(clientIp, key.ipRestrictions)) {
      return res.status(403).json({ error: 'Request from unauthorized IP address.' });
    }

    // Synthetic user
    req.apiKey = key;
    req.user = {
      _id: key._id,
      name: key.name,
      email: `apikey-${key.name}@system`,
      role: key.roles.includes('ADMIN') ? 'superadmin'
        : key.roles.includes('KHUB_ADMIN') ? 'admin'
        : 'user',
      roles: key.roles,
      groups: key.groups,
      isActive: true,
      isApiKey: true,
    };

    // Update last activity (fire-and-forget)
    key.lastActivity = new Date();
    key.save().catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
};
