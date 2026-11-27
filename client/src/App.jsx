import { useEffect, useRef, useState } from 'react';
import { useChat } from './hooks/useChat.js';
import Message from './components/Message.jsx';
import Composer from './components/Composer.jsx';

export default function App() {
  const { messages, status, error, send, stop, reset, dismissError } = useChat();
  const [model, setModel] = useState(null);
  const [knowledge, setKnowledge] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setModel(data.ok ? data.model : null);
        setKnowledge(data.knowledge ?? []);
      })
      .catch(() => setModel(null));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const streaming = status === 'streaming';

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand__logo">💬</span>
          <div>
            <h1>Chatbot</h1>
            <p className="brand__sub">
              {model
                ? `powered by ${model}${knowledge.length ? ` · grounded on ${knowledge.length} doc${knowledge.length > 1 ? 's' : ''}` : ''}`
                : 'react + express'}
            </p>
          </div>
        </div>
        <div className="header__actions">
          <span className={`status status--${status}`}>
            {streaming ? 'streaming' : status}
          </span>
          {messages.length > 0 && (
            <button type="button" className="btn btn--ghost" onClick={reset}>
              New chat
            </button>
          )}
        </div>
      </header>

      <main className="thread" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">✨</div>
            <h2>Ask me anything</h2>
            <p>Your message goes to Express, which streams back an LLM reply.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <Message key={index} message={message} />
          ))
        )}
      </main>

      {error && (
        <div className="banner" role="alert">
          <span>{error}</span>
          <button type="button" className="banner__close" onClick={dismissError}>
            ✕
          </button>
        </div>
      )}

      <Composer
        onSend={send}
        streaming={streaming}
        onStop={stop}
        suggestionsHidden={messages.length > 0}
      />
    </div>
  );
}
