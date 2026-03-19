require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { parseResume } = require('./resume-parser');
const { extractStructuredData, chatWithAI } = require('./claude-extract');
const { saveProfile } = require('./supabase-client');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/api/health', (req, res) => {
  try {
    const hasClaudeKey = !!process.env.CLAUDE_API_KEY;
    const hasSupabaseUrl = !!process.env.SUPABASE_URL;
    const hasSupabaseKey = !!process.env.SUPABASE_ANON_KEY;
    res.json({
      status: 'ok',
      env: {
        CLAUDE_API_KEY: hasClaudeKey ? 'set' : 'MISSING',
        SUPABASE_URL: hasSupabaseUrl ? 'set' : 'MISSING',
        SUPABASE_ANON_KEY: hasSupabaseKey ? 'set' : 'MISSING'
      }
    });
  } catch (err) {
    console.error('Health check error:', err.stack || err);
    res.status(500).json({ error: 'Health check failed.' });
  }
});

// Upload and parse resume
app.post('/api/upload-resume', (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err.stack || err);
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

    let text;
    try {
      text = await parseResume(req.file.buffer, ext);
    } catch (parseErr) {
      console.error('Resume parse error:', parseErr.stack || parseErr);
      return res.status(422).json({ error: 'Could not read the file. Make sure it is a valid PDF or DOCX document.' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(422).json({ error: 'No text could be extracted from the file. The document may be image-based or empty.' });
    }

    let structured;
    try {
      structured = await extractStructuredData(text);
    } catch (aiErr) {
      console.error('Claude API error:', aiErr.stack || aiErr);
      return res.status(502).json({ error: 'AI processing failed. Please check that the API key is configured correctly and try again.' });
    }

    // Return both structured data and raw text for the chat flow
    res.json({ success: true, data: structured, resumeText: text });
  } catch (err) {
    console.error('Resume upload error:', err.stack || err);
    res.status(500).json({ error: 'An unexpected error occurred while processing your resume.' });
  }
});

// AI chat endpoint for intake conversation
app.post('/api/chat', async (req, res) => {
  try {
    const { resumeData, resumeText, messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array is required.' });
    }

    if (!resumeData || !resumeText) {
      return res.status(400).json({ error: 'Invalid request: resumeData and resumeText are required.' });
    }

    let result;
    try {
      result = await chatWithAI(resumeData, resumeText, messages);
    } catch (aiErr) {
      console.error('Chat AI error:', aiErr.stack || aiErr);
      return res.status(502).json({ error: 'AI processing failed. Please try again.' });
    }

    res.json(result);
  } catch (err) {
    console.error('Chat endpoint error:', err.stack || err);
    res.status(500).json({ error: 'An unexpected error occurred.' });
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
    console.error('Save profile error:', err.stack || err);
    res.status(500).json({ error: 'Failed to save profile. Please try again.' });
  }
});

// Serve the SPA — must be after all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handler — always return JSON, never HTML
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.stack || err);
  res.status(500).json({ error: 'A server error occurred. Please try again.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AutoApply server running on port ${PORT}`);
});

module.exports = app;
