# Chatbot — React + Express

User sends a message → Express forwards it to an LLM → tokens stream back → React renders them live.

```
client (Vite/React)  ──POST /api/chat──▶  server (Express)  ──/chat/completions──▶  LLM provider
        ◀───────────── SSE stream ──────────────┘
```

## Quick start

```bash
npm install

cp server/.env.example server/.env   # then add your API key
npm run dev                         # starts API :3001 + client :5173
```

Open http://localhost:5173.

## Configuration (all env-driven)

`server/.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API port |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | Any OpenAI-compatible base URL |
| `LLM_API_KEY` | — | Provider API key (**required**) |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Model id |
| `LLM_TEMPERATURE` | `0.7` | Sampling temperature |
| `LLM_MAX_TOKENS` | `1024` | Max reply tokens |
| `LLM_SYSTEM_PROMPT` | `You are a helpful, concise assistant.` | Injected when the client sends no system message |

### Swapping providers

Any OpenAI-compatible endpoint works — change the two vars and restart:

```bash
# Grok (xAI)
LLM_BASE_URL=https://api.x.ai/v1
LLM_MODEL=grok-4-fast
LLM_API_KEY=xai-...

# Groq (free tier) — list available ids with GET /models
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-120b

# OpenRouter (many free models)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free

# Local Ollama (no key needed — any string works)
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
LLM_API_KEY=ollama
```

## Business knowledge (grounding)

The bot answers from docs in `server/knowledge/*.md` — not the model's memory.

```
server/knowledge/yasir-broast.md   ← the business facts (sample: menu, deals, policies, FAQ)
server/src/knowledge.js            ← loads docs + builds the system prompt
server/src/llm.js                  ← injects that system prompt before your messages
```

**How the system prompt is assembled** (`knowledge.js` → `buildSystemPrompt()`):

1. Persona from `LLM_SYSTEM_PROMPT`
2. Role ("customer-support assistant for Yasir Broast")
3. The knowledge files (`### Source: <file>` labelled)
4. **Grounding rules** — answer only from the knowledge, say "I don't know"
   otherwise, never invent prices/items/timings

**Why it matters:** the model only knows what's in the prompt (context).
Grounding = filling that context with *your* facts so answers are verifiable.
Without the rules, a model asked about something missing will confidently
**hallucinate** a plausible-but-false answer.

Verified behaviour:

| Question | Result |
| --- | --- |
| "Family Deal kitne ka hai aur delivery free hai?" | Rs. 1,850 + Rs. 150 delivery fee, answered in Roman Urdu (matched user language) |
| "What is the owner's net worth, and do you sell pizza?" | Refused both — "not in my information" / "not on our menu" |

`GET /api/health` reports the loaded docs: `"knowledge": ["yasir-broast.md"]`.

To give the bot your real business: edit `server/knowledge/yasir-broast.md`,
or drop more `.md` files into `server/knowledge/` (all are loaded).

## API

### `GET /api/health`
```json
{ "ok": true, "model": "llama-3.3-70b-versatile", "baseUrl": "...", "hasKey": true }
```

### `POST /api/chat`
Request:
```json
{ "messages": [ { "role": "user", "content": "Hello!" } ] }
```
Response: `text/event-stream` of JSON frames:
```
data: {"delta":"Hi"}

data: {"delta":" there"}

data: {"done":true}
```
Errors are sent as `data: {"error":"..."}`; bad input returns HTTP 400 JSON.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + client with live reload |
| `npm run dev:server` | API only (`node --watch`) |
| `npm run dev:client` | Vite only |
| `npm run build` | Build client to `client/dist` |
| `npm start` | Production API (`server/src/index.js`) |

## Layout

```
server/src/config.js   env loading + validated config
server/src/llm.js      streaming OpenAI-compatible client (fetch)
server/src/index.js    Express app, /api/health + /api/chat (SSE)
client/src/hooks/useChat.js        chat state + SSE parsing
client/src/components/Message.jsx  chat bubble + typing dots
client/src/components/Composer.jsx input, send/stop, suggestions
client/src/App.jsx                 layout, header, thread, error banner
```
