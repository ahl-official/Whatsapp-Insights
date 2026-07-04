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

  return (
    <div className="ask-message ask-message-ai">
      <span className="ask-avatar" aria-hidden>
        🤖
      </span>
      <div className="ask-message-body">
        <div className="ask-bubble ask-bubble-ai">
          {content.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              {i < content.split('\n').length - 1 && <br />}
            </span>
          ))}
        </div>
        {chartData && chartData.type !== 'line' && <CRMChart chart={chartData} />}
        <div className="ask-meta ask-meta-ai">
          AHL CRM AI · {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
}
