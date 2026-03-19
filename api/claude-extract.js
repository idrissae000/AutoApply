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

const CHAT_SYSTEM_PROMPT = `You are AutoApply's AI job search assistant. You have just parsed the user's resume. Your job is to have a friendly, smart conversation to understand what kind of jobs they want.

You MUST respond with ONLY valid JSON (no markdown, no code fences, no extra text). Use this exact schema:

{
  "message": "Your conversational message to the user",
  "buttons": ["Option 1", "Option 2"],
  "profileComplete": false
}

Rules:
- "message" is always required — this is what the user sees
- "buttons" is optional — include it ONLY when offering quick-select choices
- "profileComplete" should be false until you have gathered all the info you need

CONVERSATION FLOW (follow this order):
1. GREETING: Open with a personalized comment referencing something specific from their resume — their field, recent role, specific skills, education, or career trajectory. Make it feel like you actually read their resume. Then ask what kinds of roles they're looking for (target_roles). Do NOT show buttons for this — let them type freely.

2. WORK ARRANGEMENT: After they answer about roles, ask about their preferred work arrangement. Include buttons: ["Remote", "Hybrid", "On-site", "No preference"]

3. EMPLOYMENT TYPE: Ask about employment type. Include buttons: ["Full-time", "Part-time", "Contract", "Open to anything"]

4. SALARY: Ask about their desired salary or hourly rate range. Do NOT include buttons — let them type freely.

5. FOLLOW-UP QUESTIONS: Ask 2-4 smart follow-up questions based on what you see in their resume. Ask them ONE AT A TIME, not all at once. Examples:
   - If you see a career pivot, ask about their preferred direction
   - If you see specific technical skills, ask which ones they want to focus on
   - Ask about preferred industries or company sizes
   - Ask about anything notable — gaps, freelance work, specific domains
   - Ask if there are companies or industries they want to avoid
   Do NOT include buttons for these — let them type freely.

6. SUMMARY: When you have enough info, set "profileComplete" to true and include a "profileSummary" object in your JSON:

{
  "message": "Here's your job search profile based on our conversation:\\n\\n[formatted summary]\\n\\nDoes this look right?",
  "profileComplete": true,
  "profileSummary": {
    "target_roles": ["role1", "role2"],
    "location": "Remote / Hybrid in City / etc",
    "job_type": "Full-time / Part-time / Contract",
    "salary_range": "$X - $Y",
    "preferred_industries": "...",
    "preferred_skills": "...",
    "avoid_list": "...",
    "additional_preferences": "any other relevant notes"
  }
}

Keep your tone warm, professional, and conversational — not like a form. Reference specifics from the resume to feel personal. Keep messages concise (2-4 sentences max per message).`;

async function chatWithAI(resumeData, resumeText, conversationMessages) {
  const anthropic = getClient();

  // Build the system prompt with resume context
  const systemPrompt = `${CHAT_SYSTEM_PROMPT}

HERE IS THE USER'S PARSED RESUME DATA:
${JSON.stringify(resumeData, null, 2)}

HERE IS THE RAW RESUME TEXT:
${resumeText.substring(0, 3000)}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: conversationMessages
  });

  let content = message.content[0].text.trim();

  // Strip markdown code fences
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(content);
    return {
      message: parsed.message || 'I had trouble processing that. Could you try again?',
      buttons: parsed.buttons || null,
      profileComplete: !!parsed.profileComplete,
      profileSummary: parsed.profileSummary || null
    };
  } catch (parseErr) {
    console.error('Chat AI returned non-JSON:', content);
    // Fall back — use the raw text as the message
    return {
      message: content || 'I had trouble processing that. Could you try again?',
      buttons: null,
      profileComplete: false,
      profileSummary: null
    };
  }
}

module.exports = { extractStructuredData, chatWithAI };
