import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Load server/.env first, then allow a root .env to override/extend it.
dotenv.config({ path: path.resolve(here, '../.env') });
dotenv.config({ path: path.resolve(here, '../../.env') });

const str = (value, fallback = '') => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' ? fallback : trimmed;
};

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = {
  port: num(process.env.PORT, 3001),
  corsOrigin: str(process.env.CORS_ORIGIN, 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  llm: {
    // Any OpenAI-compatible endpoint works: Groq, xAI (Grok), OpenRouter,
    // Together, DeepSeek, OpenAI, or a local Ollama server.
    baseUrl: str(process.env.LLM_BASE_URL, 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    apiKey: str(process.env.LLM_API_KEY),
    model: str(process.env.LLM_MODEL, 'openai/gpt-oss-120b'),
    temperature: num(process.env.LLM_TEMPERATURE, 0.7),
    maxTokens: num(process.env.LLM_MAX_TOKENS, 1024),
    systemPrompt: str(
      process.env.LLM_SYSTEM_PROMPT,
      'You are a helpful, concise assistant.'
    ),
  },
};

export default env;
