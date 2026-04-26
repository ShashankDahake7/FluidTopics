const express = require('express');
const mongoose = require('mongoose');
const Topic = require('../models/Topic');

const router = express.Router();

// FT exposes individual <section id> fragments; we approximate by scanning the
// owning topic's HTML for the id and returning that subtree as a string.
// Identifier formats supported:
//   - "<topicId>#<sectionId>"  (preferred — tells us which topic to load)
//   - "<sectionId>"            (fallback — scans all topics, expensive)
router.get('/:id/html', async (req, res, next) => {
  try {
    const raw = req.params.id;
    let topicId = null;
    let sectionId = raw;
    if (raw.includes('#')) {
      [topicId, sectionId] = raw.split('#');
    }

    if (!sectionId) return res.status(400).json({ error: 'Section id required' });

    const findInHtml = (html) => {
      if (!html || !sectionId) return null;
      // Lightweight extraction — find the opening tag containing id="sectionId"
      // and balance angle-bracket nesting until the matching close. Good enough
      // for the typical Paligo / DITA output we ingest.
      const escaped = sectionId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const openRe = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\bid\\s*=\\s*['"]${escaped}['"][^>]*>`, 'i');
      const m = html.match(openRe);
      if (!m) return null;
      const startIdx = m.index;
      const tag = m[1];
      const closeTag = `</${tag}>`;
      const openTag  = new RegExp(`<${tag}\\b`, 'gi');
      let depth = 1;
      let cursor = startIdx + m[0].length;
      while (depth > 0) {
        const closeIdx = html.indexOf(closeTag, cursor);
        if (closeIdx === -1) return null;
        // Count opens between cursor and closeIdx
        const slice = html.slice(cursor, closeIdx);
        const opens = slice.match(openTag);
        depth += (opens ? opens.length : 0) - 1;
        cursor = closeIdx + closeTag.length;
        if (depth <= 0) {
          return html.slice(startIdx, cursor);
        }
      }
      return null;
    };

    let html = null;
    if (topicId && mongoose.isValidObjectId(topicId)) {
      const topic = await Topic.findById(topicId).select('content.html').lean();
      if (topic) html = findInHtml(topic.content?.html);
    } else {
      // Fallback: cursor-scan every topic. Capped to keep latency bounded.
      const cursor = Topic.find({}).select('content.html').limit(2000).cursor();
      for await (const t of cursor) {
        const found = findInHtml(t.content?.html);
        if (found) { html = found; break; }
      }
    }

    if (!html) return res.status(404).json({ error: 'Section not found' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
});

module.exports = router;
