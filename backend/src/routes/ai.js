import { callAI } from '../services/ai.js';
import { getDB } from '../db.js';
import { ObjectId } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

const SYSTEM_PROMPT = `
You are Crewli AI — a smart, friendly home service assistant built into the Crewli app.

You help customers quickly figure out what's wrong and connect them with the right professional.

Your personality:
- Warm but efficient — like a knowledgeable friend
- Speak naturally, not like a robot
- Be decisive and confident in your diagnosis
- Use simple language, avoid jargon
- Keep responses SHORT (3-5 lines max for the message)

---

SERVICE CATEGORIES (pick exactly one):
- electrical (switchboards, MCB, fan, inverter, appliances, wiring)
- plumbing (leaks, taps, drains, pressure, water motors, pipes)
- carpentry (furniture, hinges, drawers, doors, cabinets)
- walls_paint (dampness, cracks, drilling, painting, waterproofing)
- pests (termites, pigeons, ants, cockroaches, rodents)
- aluminium_glass (windows, glass panes, sliding doors)
- general_handywork (installation, locks, shelves, mounting, misc)

---

RESPONSE FORMAT (always follow this):

1. NATURAL MESSAGE — Greet by name if known, diagnose the issue, suggest next step
2. JSON BLOCK — Structured data for the app

Message rules:
- Start with the likely diagnosis
- Be specific ("Your tap washer is probably worn" not "there might be an issue")
- End with a clear action ("Let me get a plumber for you" or "Try this quick fix first")
- If the user sends an image, acknowledge what you see

---

JSON FORMAT (wrap in \`\`\`json block):
{
  "category": "<one_of_categories>",
  "issue": "<short 2-4 word label>",
  "confidence": 0.0-1.0,
  "suggest_booking": true/false,
  "urgency": "low | medium | high",
  "estimated_time": "<e.g. 30-60 mins>",
  "price_range": "<e.g. ₹200-₹500>"
}

---

BOOKING DECISION:
- suggest_booking = true → physical repair, safety risk, or user asks for help
- suggest_booking = false → simple DIY fix or user just wants advice

RULES:
- Always include both message AND json
- Never leave category empty — pick the best match
- Be decisive, avoid "maybe" or "could be"
- If an image shows the problem clearly, increase confidence
- Keep it practical — users want solutions, not lectures
`.trim();

export default async function aiRoutes(fastify) {
  // POST /ai/ask — conversation-aware AI endpoint
  fastify.post('/ai/ask', async (req, reply) => {
    const { prompt, image, sessionId, customerId, customerName, phone } = req.body;
    if (!prompt && !image) {
      return reply.code(400).send({ error: 'prompt or image is required' });
    }

    // Build personalized system prompt
    let systemPrompt = SYSTEM_PROMPT;
    if (customerName) {
      systemPrompt += `\n\nThe customer's name is ${customerName}. Address them by name when greeting.`;
    }

    try {
      const db = getDB();
      const currentSessionId = sessionId || `session_${Date.now()}_${randomBytes(4).toString('hex')}`;
      
      // Load existing history
      let chatHistory = await db.collection('chat_histories').findOne({ sessionId: currentSessionId });
      let dbMessages = chatHistory?.messages || [];
      
      // Process image if present
      let savedImageUrl = null;
      let finalImageBase64 = image;
      if (image) {
        // Only decode if it has the data uri prefix
        if (image.startsWith('data:image')) {
          const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          const filename = `ai_${Date.now()}_${randomBytes(4).toString('hex')}.png`;
          const filepath = path.join(process.cwd(), 'uploads', filename);
          await fs.mkdir(path.dirname(filepath), { recursive: true });
          await fs.writeFile(filepath, buffer);
          savedImageUrl = `/uploads/${filename}`;
          finalImageBase64 = base64Data; // for LLM
        } else {
          finalImageBase64 = image;
        }
      }

      // Build context for LLM
      const messagesForLLM = [];
      for (const msg of dbMessages) {
        if (msg.role === 'user') messagesForLLM.push({ role: 'user', content: msg.text });
        else if (msg.role === 'ai') messagesForLLM.push({ role: 'assistant', content: msg.text });
      }

      // Save user message to DB
      const userText = prompt || 'Image attached';
      const userMsg = {
        id: `user_${Date.now()}`,
        role: 'user',
        text: userText,
        imageUrl: savedImageUrl,
        timestamp: Date.now(),
      };
      
      dbMessages.push(userMsg);
      
      await db.collection('chat_histories').updateOne(
        { sessionId: currentSessionId },
        {
          $set: {
            messages: dbMessages,
            lastPrompt: userText,
            customerId: customerId || req.body.customerId || null,
            phone: phone || req.body.phone || null,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );

      // Call AI
      const response = await callAI(prompt, finalImageBase64, systemPrompt, messagesForLLM);
      
      // Save AI response
      let parsed = null;
      let aiText = response;

      const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        try {
          parsed = JSON.parse(jsonBlockMatch[1]);
          aiText = response.split('```json')[0].replace(/STRUCTURED JSON:/i, '').replace(/USER MESSAGE:/i, '').trim();
        } catch (e) { }
      } else {
        const fallbackMatch = response.match(/\{[\s\S]*\}/);
        if (fallbackMatch) {
          try {
            parsed = JSON.parse(fallbackMatch[0]);
            aiText = response.replace(fallbackMatch[0], '').replace(/STRUCTURED JSON:/i, '').replace(/USER MESSAGE:/i, '').replace(/```/g, '').trim();
          } catch (e) { }
        }
      }

      aiText = aiText.replace(/USER MESSAGE: ".*?"/s, '').trim();

      const aiMsg = {
        id: `ai_${Date.now()}`,
        role: 'ai',
        text: aiText || 'I can help with that!',
        json: parsed,
        timestamp: Date.now()
      };
      
      dbMessages.push(aiMsg);
      
      await db.collection('chat_histories').updateOne(
        { sessionId: currentSessionId },
        {
          $set: {
            messages: dbMessages,
            updatedAt: new Date(),
          }
        }
      );

      return { response, sessionId: currentSessionId };
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ error: e.message || 'AI service failed' });
    }
  });

  // POST /ai/history — save chat history
  fastify.post('/ai/history', async (req, reply) => {
    const { sessionId, messages, phone } = req.body;
    if (!sessionId || !Array.isArray(messages)) {
      return reply.code(400).send({ error: 'sessionId and messages required' });
    }

    try {
      const db = getDB();
      await db.collection('chat_histories').updateOne(
        { sessionId },
        {
          $set: {
            messages,
            customerId: req.body.customerId || null,
            phone: phone || null,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
      return { ok: true };
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ error: 'Failed to save chat history' });
    }
  });

  // GET /ai/history?customerId=xxx&phone=yyy&sessionId=zzz
  fastify.get('/ai/history', async (req, reply) => {
    const { customerId, phone, sessionId } = req.query;
    if (!customerId && !phone && !sessionId) {
      return reply.code(400).send({ error: 'customerId, phone or sessionId required' });
    }

    try {
      const db = getDB();
      let filter = {};
      if (sessionId) {
        filter = { sessionId };
      } else if (customerId) {
        filter = { customerId };
      } else if (phone) {
        filter = { phone };
      }
      const docs = await db.collection('chat_histories')
        .find(filter)
        .sort({ updatedAt: -1 })
        .limit(1)
        .toArray();
      return { messages: docs[0]?.messages || [], sessionId: docs[0]?.sessionId || null };
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ error: 'Failed to load chat history' });
    }
  });

  // GET /ai/sessions?customerId=xxx&phone=yyy
  fastify.get('/ai/sessions', async (req, reply) => {
    const { customerId, phone } = req.query;
    if (!customerId && !phone) {
      return reply.code(400).send({ error: 'customerId or phone required' });
    }

    try {
      const db = getDB();
      const filter = customerId ? { customerId } : { phone };
      const docs = await db.collection('chat_histories')
        .find(filter)
        .sort({ updatedAt: -1 })
        .limit(50)
        .project({ sessionId: 1, updatedAt: 1, lastPrompt: 1, messages: { $slice: 1 } })
        .toArray();

      const sessions = docs.map((d) => ({
        sessionId: d.sessionId,
        updatedAt: d.updatedAt,
        preview: d.lastPrompt || d.messages?.[0]?.text?.slice(0, 80) || 'Chat',
      }));

      return { sessions };
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ error: 'Failed to list sessions' });
    }
  });
}