const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function parseResume(buffer, ext) {
  if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

module.exports = { parseResume };
