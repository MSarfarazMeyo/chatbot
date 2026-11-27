import env from './config.js';

/**
 * Streams a chat completion from any OpenAI-compatible provider.
 *
 * Yields string deltas as they arrive. Throws an Error with a
 * human-readable message when the provider rejects the request.
 */
export async function* streamChat(messages, { signal } = {}) {
  const { baseUrl, apiKey, model, temperature, maxTokens, systemPrompt } = env.llm;

  if (!apiKey) {
    throw new Error(
      'LLM_API_KEY is not set. Copy server/.env.example to server/.env and fill it in.'
    );
  }

  const hasSystem = messages.some((message) => message.role === 'system');
  const payloadMessages = hasSystem
    ? messages
    : [{ role: 'system', content: systemPrompt }, ...messages];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: payloadMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let detail = body;
    try {
      detail = JSON.parse(body)?.error?.message ?? body;
    } catch {
      /* keep raw body */
    }
    const error = new Error(
      `Provider error ${response.status}: ${detail || response.statusText}`
    );
    error.status = response.status;
    throw error;
  }

  if (!response.body) {
    throw new Error('Provider returned no response body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            yield delta;
          }
        } catch {
          // Ignore keep-alives or partial JSON frames.
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}
