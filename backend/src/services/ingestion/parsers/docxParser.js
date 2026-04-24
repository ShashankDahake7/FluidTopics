const mammoth = require('mammoth');
const { parseHTML } = require('./htmlParser');

/**
 * Parse DOCX content into structured sections
 * @param {Buffer|string} input - File buffer or path to DOCX file
 * @param {string} filename - Original filename
 * @returns {Object} Parsed document structure
 */
const parseDOCX = async (input, filename = '') => {
  const options = {
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
    ],
    convertImage: mammoth.images.imgElement(function (image) {
      return image.read('base64').then(function (imageBuffer) {
        return {
          src: `data:${image.contentType};base64,${imageBuffer}`,
          alt: '',
        };
      });
    }),
  };

  let result;
  if (Buffer.isBuffer(input)) {
    result = await mammoth.convertToHtml({ buffer: input }, options);
  } else {
    result = await mammoth.convertToHtml({ path: input }, options);
  }

  if (result.messages.length > 0) {
    console.log(
      'DOCX conversion messages:',
      result.messages.map((m) => m.message)
    );
  }

  // Parse the generated HTML
  const parsed = parseHTML(result.value, filename);

  return parsed;
};

module.exports = { parseDOCX };
