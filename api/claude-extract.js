const Anthropic = require('@anthropic-ai/sdk');

let client;

function getClient() {
  if (!client) {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error('CLAUDE_API_KEY environment variable is not set.');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

async function extractStructuredData(resumeText) {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
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

  let content = message.content[0].text.trim();

  // Strip markdown code fences if Claude wraps the response
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(content);
  } catch (parseErr) {
    console.error('Claude returned non-JSON content:', content);
    throw new Error('Failed to parse structured data from AI response.');
  }
}

module.exports = { extractStructuredData };
