const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMMA_MODEL = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';

/**
 * Standalone Gemini/Gemma helper used by other parts of the codebase
 * (e.g. image classification, catalog search).
 */
export async function callGemini(prompt, imageBase64, systemPrompt) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const contents = [{
    role: 'user',
    parts: []
  }];

  if (imageBase64) {
    contents[0].parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64
      }
    });
  }

  contents[0].parts.push({ text: prompt });

  const body = {
    contents,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 1000,
    }
  };

  if (systemPrompt) {
    body.systemInstruction = {
      role: 'model',
      parts: [{ text: systemPrompt }]
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error?.message || 'Gemma API error');
  }

  return json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI';
}
