const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { detectFormat } = require('../../utils/helpers');

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']);

/**
 * Extract and process ZIP files
 * @param {string} zipPath - Path to the ZIP file
 * @returns {{ files: Array, images: Array }} Content files and image buffers
 */
const handleZip = (zipPath) => {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const files = [];
  const images = [];

  entries.forEach((entry) => {
    // Skip directories, hidden files, and macOS resource forks
    if (
      entry.isDirectory ||
      entry.entryName.startsWith('__MACOSX') ||
      entry.entryName.startsWith('.')
    ) {
      return;
    }

    const filename = path.basename(entry.entryName);
    const ext = filename.toLowerCase().split('.').pop();

    // Collect image files separately (they need to be saved to disk)
    if (IMAGE_EXTS.has(ext)) {
      images.push({
        zipPath: entry.entryName,
        filename,
        content: entry.getData(), // Buffer
      });
      return;
    }

    const format = detectFormat(filename);

    if (!format) {
      console.log(`⚠️  Skipping unsupported file in ZIP: ${entry.entryName}`);
      return;
    }

    const content = entry.getData();

    files.push({
      filename,
      path: entry.entryName,
      format,
      content: format === 'docx' ? content : content.toString('utf-8'),
      size: entry.header.size,
    });
  });

  console.log(`📦 Extracted ${files.length} content files and ${images.length} images from ZIP`);
  return { files, images };
};

module.exports = { handleZip };
