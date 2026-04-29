const crypto = require('crypto');
const config = require('../../config/env');
const {
  putObject,
  extractedCasKey,
} = require('../storage/s3Service');

/**
 * Extract and save media (images) from parsed content
 * Replaces base64 inline images with file references in S3
 */
const extractMedia = async (parsedDoc) => {
  const mediaItems = [];

  // Process images
  if (parsedDoc.images) {
    for (const img of parsedDoc.images) {
      if (img.src.startsWith('data:')) {
        // Base64 inline image — save to S3
        const saved = await saveBase64Image(img.src);
        if (saved) {
          mediaItems.push({
            type: 'image',
            url: `/api/portal/media/${saved.key}`,
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
 * Save base64-encoded image to S3
 */
const saveBase64Image = async (dataUri) => {
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

    // Generate hash-based filename (sha256 for CAS)
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const key = extractedCasKey(hash, ext);

    if (!key) return null;

    // Upload to S3
    await putObject({
      bucket: config.s3.extractedBucket,
      key,
      body: buffer,
      contentType: mimeType,
    });

    return { key, mimeType, size: buffer.length };
  } catch (error) {
    console.error('Error saving base64 image to S3:', error.message);
    return null;
  }
};

module.exports = { extractMedia };
