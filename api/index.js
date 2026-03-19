require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { parseResume } = require('./resume-parser');
const { extractStructuredData } = require('./claude-extract');
const { saveProfile } = require('./supabase-client');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Upload and parse resume
app.post('/api/upload-resume', (req, res, next) => {
  // Wrap multer in manual call so we can catch its errors as JSON
  upload.single('resume')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File is too large. Maximum size is 10 MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(500).json({ error: 'File upload failed. Please try again.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.pdf', '.docx'].includes(ext)) {
      return res.status(400).json({ error: 'Only PDF and DOCX files are supported.' });
    }

    // Parse document to text
    let text;
    try {
      text = await parseResume(req.file.buffer, ext);
    } catch (parseErr) {
      console.error('Resume parse error:', parseErr);
      return res.status(422).json({ error: 'Could not read the file. Make sure it is a valid PDF or DOCX document.' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(422).json({ error: 'No text could be extracted from the file. The document may be image-based or empty.' });
    }

    // Extract structured data via Claude
    let structured;
    try {
      structured = await extractStructuredData(text);
    } catch (aiErr) {
      console.error('Claude API error:', aiErr);
      return res.status(502).json({ error: 'AI processing failed. Please check that the API key is configured correctly and try again.' });
    }

    res.json({ success: true, data: structured });
  } catch (err) {
    console.error('Resume upload error:', err);
    res.status(500).json({ error: 'An unexpected error occurred while processing your resume.' });
  }
});

// Save completed profile
app.post('/api/save-profile', async (req, res) => {
  try {
    const profile = req.body;

    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ error: 'Invalid profile data.' });
    }

    const result = await saveProfile(profile);
    res.json({ success: true, id: result.id });
  } catch (err) {
    console.error('Save profile error:', err);
    res.status(500).json({ error: 'Failed to save profile. Please try again.' });
  }
});

// Serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handler — always return JSON
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'A server error occurred. Please try again.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AutoApply server running on port ${PORT}`);
});

module.exports = app;
