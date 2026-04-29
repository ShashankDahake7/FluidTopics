const mongoose = require('mongoose');
const env = require('../config/env');
const connectDB = require('../config/db');
const SavedSearch = require('../models/SavedSearch');
const User = require('../models/User');
const AlertsConfig = require('../models/AlertsConfig');
const Topic = require('../models/Topic');
const searchService = require('../services/search/searchService');
const emailService = require('../services/email/emailService');

async function run() {
  await connectDB();

  const cfg = await AlertsConfig.getSingleton();
  
  // Optionally check day of week, but for manual/testing we'll just run it.
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const isRecurrenceDay = (cfg.recurrenceDays || []).includes(today);
  const force = process.argv.includes('--force');

  if (!isRecurrenceDay && !force) {
    console.log(`[Alerts] Today (${today}) is not a scheduled recurrence day: ${cfg.recurrenceDays.join(', ')}. Use --force to run anyway.`);
    process.exit(0);
  }

  console.log('[Alerts] Starting Saved Searches background worker...');

  // Find all saved searches that have email notifications enabled
  const searches = await SavedSearch.find({ notify: true }).populate('userId');
  let sentCount = 0;

  for (const saved of searches) {
    if (!saved.userId || !saved.userId.isActive) continue;

    const user = saved.userId;
    // Default to searching for content updated in the last 7 days if it's the first run
    const lastRun = saved.lastRunAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Apply the updatedAfter filter
    const filters = {
      ...(saved.filters || {}),
      updatedAfter: lastRun,
    };

    console.log(`[Alerts] Running search "${saved.name}" for user ${user.email} (since ${lastRun.toISOString()})...`);

    try {
      // 1. Run the search
      const result = await searchService.search({
        query: saved.query,
        filters,
        limit: 50, // Grab up to 50 new hits
        sort: 'date'
      });

      if (result.hits.length === 0) {
        console.log(`   -> No new results found.`);
        // Even if no results, update lastRunAt so we don't scan this window again
        saved.lastRunAt = new Date();
        await saved.save();
        continue;
      }

      // 2. Fetch full topics to get complete metadata for the email body
      const topicIds = result.hits.map((h) => h._id || h.id);
      const fullTopics = await Topic.find({ _id: { $in: topicIds } }).lean();
      const topicMap = new Map(fullTopics.map((t) => [String(t._id), t]));

      // 3. Format the email
      let html = `<div style="font-family: sans-serif; color: #1f2937;">`;
      html += `<h2 style="color: #1976D2;">New Content Alert</h2>`;
      html += `<p>We found <b>${result.hits.length}</b> new or updated topics matching your saved search <b>"${saved.name}"</b>.</p>`;
      
      html += `<ul style="list-style: none; padding: 0; margin-top: 24px;">`;
      
      for (const hit of result.hits) {
        const topic = topicMap.get(String(hit._id || hit.id));
        if (!topic) continue;

        // Build the URL to the topic
        const url = env.appUrl + (topic.prettyUrl || `/r/${topic.slug}`);

        html += `<li style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">`;
        html += `  <a href="${url}" style="font-size: 18px; color: #2563eb; text-decoration: none; font-weight: 600;">${topic.title || 'Untitled'}</a>`;
        
        // Append requested metadata keys
        if (cfg.bodyMetadataKeys && cfg.bodyMetadataKeys.length > 0) {
          html += `<div style="margin-top: 8px; font-size: 14px; color: #4b5563;">`;
          
          for (const key of cfg.bodyMetadataKeys) {
            let val = topic.metadata?.[key];
            if (val === undefined) {
              // Try flattening custom fields if nested
              if (topic.metadata?.customFields && topic.metadata.customFields[key]) {
                val = topic.metadata.customFields[key];
              }
            }
            if (val) {
              html += `<div style="margin-bottom: 4px;"><strong>${key}:</strong> ${val}</div>`;
            }
          }
          html += `</div>`;
        }
        
        html += `</li>`;
      }
      
      html += `</ul>`;
      html += `<p style="margin-top: 32px; font-size: 12px; color: #9ca3af;">You are receiving this email because you subscribed to the saved search "${saved.name}".</p>`;
      html += `</div>`;

      // 4. Send the email
      await emailService.sendMail({
        to: user.email,
        subject: `[Fluid Topics] New results for "${saved.name}"`,
        html,
      });

      console.log(`   -> Sent email with ${result.hits.length} hits to ${user.email}`);

      // 5. Update state
      saved.lastRunAt = new Date();
      saved.runCount = (saved.runCount || 0) + 1;
      await saved.save();
      
      sentCount++;

    } catch (err) {
      console.error(`   -> Error running search "${saved.name}":`, err);
    }
  }

  console.log(`[Alerts] Finished. Sent ${sentCount} alert emails.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('[Alerts] Fatal error:', err);
  process.exit(1);
});
