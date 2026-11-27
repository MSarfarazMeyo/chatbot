import { useEffect, useRef, useState } from 'react';

const SUGGESTIONS = [
  'Family Deal kitne ka hai?',
  'Do you deliver at 2 AM?',
  'Student Deal ka time kya hai?',
];

export default function Composer({ onSend, streaming, onStop, suggestionsHidden }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    if (!value.trim() || streaming) return;
    onSend(value);
    setValue('');
  };

  return (
    <>
      {!suggestionsHidden && (
        <div className="suggestions">
          {SUGGESTIONS.map((text) => (
            <button
              key={text}
              type="button"
              className="chip"
              disabled={streaming}
              onClick={() => onSend(text)}
            >
              {text}
            </button>
          ))}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder="Yasir Broast se kuch poochein…"
          aria-label="Message"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />

        {streaming ? (
          <button type="button" className="btn btn--stop" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn btn--send" disabled={!value.trim()}>
            Send
          </button>
        )}
      </form>
    </>
  );
}
