'use client';

export default function TypingIndicator() {
  return (
    <div className="ask-message ask-message-ai">
      <span className="ask-avatar" aria-hidden>
        🤖
      </span>
      <div className="ask-message-body">
        <div className="ask-bubble ask-bubble-ai ask-typing">
          <span className="ask-dot" />
          <span className="ask-dot" />
          <span className="ask-dot" />
        </div>
      </div>
    </div>
  );
}
