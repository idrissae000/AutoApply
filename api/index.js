require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { parseResume } = require('./resume-parser');
const { extractStructuredData } = require('./claude-extract');
const { saveProfile } = require('./supabase-client');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Upload and parse resume
app.post('/api/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.pdf', '.docx'].includes(ext)) {
      return res.status(400).json({ error: 'Only PDF and DOCX files are supported' });
    }

    const text = await parseResume(req.file.buffer, ext);
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from resume' });
    }

    const structured = await extractStructuredData(text);
    res.json({ success: true, data: structured });
  } catch (err) {
    console.error('Resume upload error:', err);
    res.status(500).json({ error: 'Failed to process resume' });
  }
});

// Save completed profile
app.post('/api/save-profile', async (req, res) => {
  try {
    const profile = req.body;
    const result = await saveProfile(profile);
    res.json({ success: true, id: result.id });
  } catch (err) {
    console.error('Save profile error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AutoApply server running on port ${PORT}`);
});

module.exports = app;
