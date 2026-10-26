const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMMA_MODEL = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';

/**
 * Call Google's Generative AI API using a Gemma model.
 * Replaces the previous OpenRouter integration.
 *
 * Supports text, optional image (base64), a system prompt,
 * and conversation history for multi-turn context.
 */
export async function callAI(prompt, imageBase64, systemPrompt, history = []) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Build the contents array with history + current message
  const contents = [];

  // Add conversation history
  if (Array.isArray(history) && history.length > 0) {
    for (const msg of history) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  // Build the current user message parts
  const userParts = [];

  if (imageBase64) {
    userParts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    });
  }

  userParts.push({ text: prompt || 'Describe this image' });
  contents.push({ role: 'user', parts: userParts });

  const body = {
    contents,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 1000,
    },
  };

  // Add system instruction if provided
  if (systemPrompt) {
    body.systemInstruction = {
      role: 'model',
      parts: [{ text: systemPrompt }],
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error?.message || 'Gemma AI service error');
  }

  return json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI';
}
