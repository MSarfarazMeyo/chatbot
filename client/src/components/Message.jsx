export default function Message({ message }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`row ${isUser ? 'row--user' : 'row--assistant'}`}>
      {isAssistant && <div className="avatar" aria-hidden="true">🤖</div>}
      <div className="bubble">
        {message.content === '' && isAssistant ? (
          <span className="typing" aria-label="Assistant is typing">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </span>
        ) : (
          message.content
        )}
      </div>
      {isUser && <div className="avatar avatar--user" aria-hidden="true">🧑</div>}
    </div>
  );
}
