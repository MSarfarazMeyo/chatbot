import express from 'express';
import cors from 'cors';
import env from './config.js';
import { streamChat } from './llm.js';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

const ROLES = new Set(['system', 'user', 'assistant']);

/** Validates the incoming { messages } body. Returns an error string or null. */
function validateMessages(body) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Body must be a non-empty "messages" array.';
  }
  if (messages.length > 100) {
    return 'Too many messages (max 100).';
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      return 'Each message must be an object.';
    }
    if (!ROLES.has(message.role)) {
      return `Invalid role "${message?.role}". Use system, user, or assistant.`;
    }
    if (typeof message.content !== 'string' || message.content.trim() === '') {
      return 'Each message needs a non-empty string "content".';
    }
  }
  return null;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: env.llm.model,
    baseUrl: env.llm.baseUrl,
    hasKey: Boolean(env.llm.apiKey),
  });
});

app.post('/api/chat', async (req, res) => {
  const error = validateMessages(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const messages = req.body.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  // Server-sent events: the client reads these incrementally.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  const controller = new AbortController();
  const abort = () => controller.abort();
  // `res` (not `req`) fires "close" only when the connection actually goes away;
  // IncomingMessage emits "close" as soon as the body is fully read.
  res.on('close', abort);

  try {
    for await (const delta of streamChat(messages, { signal: controller.signal })) {
      send({ delta });
    }
    send({ done: true });
  } catch (err) {
    if (controller.signal.aborted) {
      // Client disconnected (Stop button or closed tab) — nothing to report.
      send({ done: true });
    } else {
      console.error('[llm]', err.message);
      send({ error: err.message });
    }
  } finally {
    res.off('close', abort);
    res.end();
  }
});

app.use((err, _req, res, _next) => {
  console.error('[express]', err.message);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
  console.log(`  provider: ${env.llm.baseUrl}`);
  console.log(`  model:    ${env.llm.model}`);
  console.log(`  key:      ${env.llm.apiKey ? 'set' : 'MISSING (see server/.env.example)'}`);
});
