import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import env from './config.js';

const KNOWLEDGE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../knowledge'
);

/** Names of every `.md` knowledge file (sorted). */
export function listKnowledgeFiles() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return [];
  return fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort();
}

/** Raw contents of every knowledge file, concatenated with source labels. */
export function loadKnowledge() {
  return listKnowledgeFiles()
    .map((name) => {
      const body = fs.readFileSync(path.join(KNOWLEDGE_DIR, name), 'utf8');
      return `### Source: ${name}\n\n${body}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Anti-hallucination rules. This is the "grounding contract" with the model:
 * answer only from the context above, otherwise admit you don't know.
 */
const GROUNDING_RULES = `## Grounding rules (must follow)
1. Answer ONLY from the business knowledge above.
2. If the answer is not in the knowledge, say you don't have that information
   and suggest contacting Yasir Broast directly. Never guess or fill gaps.
3. Never invent prices, menu items, deals, timings, branch details or phone numbers.
4. Prices are in PKR (Rs.) exactly as listed — no conversions, no rounding.
5. Reply in the user's language: English, Urdu, or Roman Urdu.
6. Keep answers short, friendly and factual.`;

/**
 * Builds the system prompt: persona + business knowledge + grounding rules.
 * This is what "gives the bot a brain about the business" — the model sees
 * nothing else, so everything it can honestly answer must be in here.
 */
export function buildSystemPrompt() {
  const knowledge = loadKnowledge();
  const files = listKnowledgeFiles();

  if (files.length === 0) {
    // No docs — fall back to the plain persona from .env.
    return env.llm.systemPrompt;
  }

  return [
    env.llm.systemPrompt,
    'You are the customer-support assistant for Yasir Broast, a Pakistani fast-food chain.',
    '# Business knowledge (your only source of truth)',
    knowledge,
    GROUNDING_RULES,
  ].join('\n\n');
}
