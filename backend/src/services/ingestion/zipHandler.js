const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { detectFormat } = require('../../utils/helpers');

/**
 * Extract and process ZIP files
 * @param {string} zipPath - Path to the ZIP file
 * @returns {Array<Object>} Array of { filename, content, format }
 */
const handleZip = (zipPath) => {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const files = [];

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

  console.log(`📦 Extracted ${files.length} processable files from ZIP`);
  return files;
};

module.exports = { handleZip };
