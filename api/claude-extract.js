const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

async function extractStructuredData(resumeText) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Extract structured information from the following resume text. Return ONLY valid JSON with no markdown formatting, no code fences, and no extra text. Use exactly this schema:

{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "dates": "start - end",
      "description": "brief description"
    }
  ],
  "education": [
    {
      "degree": "degree name",
      "institution": "school name",
      "dates": "start - end"
    }
  ]
}

If a field is not found in the resume, use null for strings, an empty array for arrays.

Resume text:
${resumeText}`
      }
    ]
  });

  const content = message.content[0].text.trim();
  return JSON.parse(content);
}

module.exports = { extractStructuredData };
