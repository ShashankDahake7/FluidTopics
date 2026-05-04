'use strict';

/**
 * Fluid Topics device categorization from viewport (page.display).
 * @param {number} w viewport width (CSS px)
 * @param {number} h viewport height (CSS px)
 * @returns {'mobile'|'tablet'|'desktop'|'unknown'}
 */
function deviceTypeFromViewport(w, h) {
  const width = Number(w);
  const height = Number(h);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'unknown';
  }
  const portrait = width <= height;
  if (portrait) {
    if (width <= 480) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }
  if (width <= 768) return 'mobile';
  if (width <= 1280) return 'tablet';
  return 'desktop';
}

module.exports = { deviceTypeFromViewport };
