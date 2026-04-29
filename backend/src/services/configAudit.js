/**
 * Utility to log configuration changes to the ConfigChange collection.
 *
 * Usage in a route handler:
 *
 *   const { logConfigChange } = require('../services/configAudit');
 *
 *   // After saving the updated config:
 *   await logConfigChange({
 *     category: 'Access rules',
 *     author: req.user.name || req.user.email,
 *     authorEmail: req.user.email,
 *     before: previousConfigSnapshot,
 *     after:  updatedConfigSnapshot,
 *   });
 */
const ConfigChange = require('../models/ConfigChange');

async function logConfigChange({ category, author, authorEmail, before, after }) {
  try {
    await ConfigChange.create({
      category,
      author: author || 'Unknown',
      authorEmail: authorEmail || '',
      before: before || {},
      after: after || {},
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error('[ConfigAudit] Failed to log change:', err.message);
  }
}

module.exports = { logConfigChange };
