import fs from 'fs/promises';
import path from 'path';

export default async function uploadRoutes(fastify) {
  fastify.post('/upload', async (req, reply) => {
    const { base64 } = req.body || {};
    if (!base64) return reply.code(400).send({ error: 'base64 image required' });

    try {
      // Remove header if present (e.g. "data:image/jpeg;base64,")
      const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let ext = '.jpg';
      if (matches && matches.length === 3) {
        buffer = Buffer.from(matches[2], 'base64');
        const mime = matches[1];
        if (mime === 'image/png') ext = '.png';
      } else {
        buffer = Buffer.from(base64, 'base64');
      }

      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
      const filepath = path.join(process.cwd(), 'public', 'uploads', filename);

      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, buffer);

      return { url: `/uploads/${filename}` };
    } catch (e) {
      req.log.error('Upload error:', e);
      return reply.code(500).send({ error: 'failed to save image' });
    }
  });
}
