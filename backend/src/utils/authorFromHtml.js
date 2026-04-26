const cheerio = require('cheerio');

/**
 * Best-effort author name from exported help HTML (e.g. Paligo index-en.html, topic pages).
 * Tries common meta tags and JSON-LD before returning ''.
 */
function extractAuthorFromHtml(html) {
  if (!html || typeof html !== 'string') return '';
  let $;
  try {
    $ = cheerio.load(html);
  } catch {
    return '';
  }

  const metaContentCI = (nameLower) => {
    const want = String(nameLower).toLowerCase();
    let out = '';
    $('meta[name]').each((_, m) => {
      if (out) return;
      const n = String($(m).attr('name') || '').toLowerCase();
      if (n === want) out = ($(m).attr('content') || '').trim();
    });
    return out;
  };

  const fromProp = (property) => {
    const want = String(property).toLowerCase();
    let out = '';
    $('meta[property]').each((_, m) => {
      if (out) return;
      const p = String($(m).attr('property') || '').toLowerCase();
      if (p === want) out = ($(m).attr('content') || '').trim();
    });
    return out;
  };

  let author =
    metaContentCI('author') ||
    metaContentCI('dcterms.creator') ||
    metaContentCI('dc.creator') ||
    metaContentCI('ft:author') ||
    metaContentCI('creator') ||
    fromProp('article:author') ||
    '';

  // Paligo / DocBook: author in title page, not in <meta> (e.g. index-en.html).
  if (!author) {
    author =
      $('.titlepage h3.author, .titlepage h2.author, .titlepage h4.author').first().text().trim() ||
      $('.titlepage .author h3, .titlepage .author h2, .titlepage .author h4').first().text().trim() ||
      $('.topic-content .titlepage .author').first().text().trim() ||
      $('article.article .titlepage .author').first().text().trim() ||
      '';
  }

  if (!author) {
    $('script[type="application/ld+json"]').each((_, el) => {
      if (author) return false;
      try {
        const raw = $(el).contents().text() || $(el).html() || '';
        if (!raw.trim()) return;
        const data = JSON.parse(raw.trim());
        const list = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const obj of list) {
          if (!obj || typeof obj !== 'object') continue;
          const a = obj.author;
          if (typeof a === 'string' && a.trim()) {
            author = a.trim();
            return false;
          }
          if (a && typeof a === 'object') {
            if (typeof a.name === 'string' && a.name.trim()) {
              author = a.name.trim();
              return false;
            }
            if (Array.isArray(a) && a.length) {
              const first = a[0];
              if (typeof first === 'string' && first.trim()) {
                author = first.trim();
                return false;
              }
              if (first && typeof first.name === 'string' && first.name.trim()) {
                author = first.name.trim();
                return false;
              }
            }
          }
        }
      } catch {
        /* ignore malformed JSON-LD */
      }
    });
  }

  return author.replace(/\s+/g, ' ').trim();
}

module.exports = { extractAuthorFromHtml };
