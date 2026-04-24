const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../../config/env');

const MEDIA_DIR = path.resolve(config.upload.dir, 'media');

// Ensure media directory exists
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

/**
 * Extract and save media (images) from parsed content
 * Replaces base64 inline images with file references
 */
const extractMedia = async (parsedDoc) => {
  const mediaItems = [];

  // Process images
  if (parsedDoc.images) {
    for (const img of parsedDoc.images) {
      if (img.src.startsWith('data:')) {
        // Base64 inline image — save to disk
        const saved = saveBase64Image(img.src);
        if (saved) {
          mediaItems.push({
            type: 'image',
            url: `/uploads/media/${saved.filename}`,
            alt: img.alt || '',
            caption: img.title || '',
            originalSrc: img.src.substring(0, 50) + '...',
          });
        }
      } else if (img.src) {
        // External URL reference — keep as-is
        mediaItems.push({
          type: 'image',
          url: img.src,
          alt: img.alt || '',
          caption: img.title || '',
        });
      }
    }
  }

  // Process tables
  if (parsedDoc.tables) {
    parsedDoc.tables.forEach((table) => {
      mediaItems.push({
        type: 'table',
        url: '',
        alt: `Table ${table.index + 1}`,
        caption: '',
      });
    });
  }

  return mediaItems;
};

/**
 * Save base64-encoded image to disk
 */
const saveBase64Image = (dataUri) => {
  try {
    const matches = dataUri.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return null;

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Determine extension from MIME type
    const extMap = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'image/webp': '.webp',
    };
    const ext = extMap[mimeType] || '.png';

    // Generate hash-based filename
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const filename = `${hash}${ext}`;
    const filepath = path.join(MEDIA_DIR, filename);

    // Skip if already exists (dedup)
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, buffer);
    }

    return { filename, filepath, mimeType, size: buffer.length };
  } catch (error) {
    console.error('Error saving base64 image:', error.message);
    return null;
  }
};

module.exports = { extractMedia };
