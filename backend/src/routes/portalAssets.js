const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

const router = express.Router();

const ASSET_ROOT = path.resolve(config.upload.dir, 'portal-assets');
fs.mkdirSync(ASSET_ROOT, { recursive: true });

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

/**
 * Initials from slug like "Shikha-Gheyee" → "SG"
 */
function initialsFromSlug(slug) {
  const parts = slug.split('-').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function placeholderSvg(slug) {
  const ch = initialsFromSlug(slug);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="8" fill="#e2e8f0"/>
  <text x="32" y="38" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="600" fill="#475569">${ch}</text>
</svg>`;
}

/**
 * GET /api/portal-asset/:key
 * Darwinbox-style author avatars: key is usually "{FirstName}-{LastName}-avatar".
 * Looks for a file under uploads/portal-assets/ (jpg/png/webp/gif or exact key).
 * Otherwise returns a small SVG placeholder (so <img> always has a valid src).
 */
router.get('/portal-asset/:key', (req, res) => {
  const raw = String(req.params.key || '');
  if (!raw || raw.includes('..') || raw.includes('/') || raw.includes('\\')) {
    return res.status(400).send('Bad key');
  }

  const key = raw.replace(/[^a-zA-Z0-9_.-]/g, '');

  // Email-logo uploads (uploaded via /api/admin/email/logo) are stored under
  // ASSET_ROOT with a `email-logo-<uuid>.<ext>` filename. Serve them directly
  // when the key matches that prefix — this is the public URL embedded in
  // notification emails.
  if (key.startsWith('email-logo-')) {
    const candidate = path.join(ASSET_ROOT, key);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.setHeader('Content-Type', mimeFor(candidate));
        res.setHeader('Cache-Control', 'public, max-age=300');
        return fs.createReadStream(candidate).pipe(res);
      }
    } catch { /* fall through to 404 */ }
    return res.status(404).send('Not found');
  }

  if (!key.endsWith('-avatar')) {
    return res.status(404).send('Not found');
  }

  const slug = key.replace(/-avatar$/, '') || 'author';
  const base = path.join(ASSET_ROOT, slug);
  const candidates = [
    path.join(ASSET_ROOT, key),
    `${base}.jpg`,
    `${base}.jpeg`,
    `${base}.png`,
    `${base}.webp`,
    `${base}.gif`,
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.setHeader('Content-Type', mimeFor(filePath));
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return fs.createReadStream(filePath).pipe(res);
      }
    } catch {
      /* continue */
    }
  }

  const svg = placeholderSvg(slug);
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(svg);
});

module.exports = router;
