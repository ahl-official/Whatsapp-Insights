'use client';

import CRMChart from '@/components/CRMChart';
import type { ChartData } from '@/lib/parseChart';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  chartData?: ChartData | null;
  timestamp: Date;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Render **bold** markers as <strong> */
function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function ChatMessage({
  role,
  content,
  chartData,
  timestamp,
}: ChatMessageProps) {
  const isUser = role === 'user';

  if (isUser) {
    return (
      <div className="ask-message ask-message-user">
        <div className="ask-message-body">
          <div className="ask-bubble ask-bubble-user">{content}</div>
          <div className="ask-meta ask-meta-user">
            You · {formatTime(timestamp)}
          </div>
        </div>
      </div>
    );
  }

  const lines = content.split('\n');

  return (
    <div className="ask-message ask-message-ai">
      <span className="ask-avatar" aria-hidden>
        🤖
      </span>
      <div className="ask-message-body">
        <div className="ask-bubble ask-bubble-ai">
          {lines.map((line, i) => (
            <span key={i}>
              {renderInlineMarkdown(line)}
              {i < lines.length - 1 && <br />}
            </span>
          ))}
        </div>
        {chartData && chartData.type !== 'line' && (
          <div className="ask-chart-wrap">
            <CRMChart chart={chartData} />
          </div>
        )}
        <div className="ask-meta ask-meta-ai">
          AHL CRM AI · {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
}
