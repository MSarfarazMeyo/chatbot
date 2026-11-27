import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drives the chat: sends message history to POST /api/chat and appends
 * streamed tokens to the in-flight assistant message.
 */
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | streaming | error
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStatus('idle');
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus('idle');
  }, []);

  const send = useCallback(
    async (text) => {
      const content = text.trim();
      if (!content || status === 'streaming') return;

      setError(null);
      const history = [...messages, { role: 'user', content }];
      setMessages([...history, { role: 'assistant', content: '' }]);
      setStatus('streaming');

      const controller = new AbortController();
      abortRef.current = controller;

      const appendToLast = (delta) =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + delta };
          }
          return next;
        });

      const dropEmptyReply = () =>
        setMessages((prev) =>
          prev.length && prev[prev.length - 1].role === 'assistant' &&
          prev[prev.length - 1].content === ''
            ? prev.slice(0, -1)
            : prev
        );

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || `Request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

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
            if (data === '[DONE]') continue;

            let event;
            try {
              event = JSON.parse(data);
            } catch {
              continue;
            }

            if (typeof event.error === 'string') {
              throw new Error(event.error);
            }
            if (typeof event.delta === 'string' && event.delta) {
              appendToLast(event.delta);
            }
          }
        }

        setStatus('idle');
      } catch (err) {
        if (err.name === 'AbortError') {
          setStatus('idle'); // keep whatever partial text arrived
          return;
        }
        dropEmptyReply();
        setError(err.message);
        setStatus('error');
      } finally {
        abortRef.current = null;
      }
    },
    [messages, status]
  );

  // Stop streaming if the tab loses the connection entirely.
  useEffect(() => () => abortRef.current?.abort(), []);

  return { messages, status, error, send, stop, reset, dismissError };
}
