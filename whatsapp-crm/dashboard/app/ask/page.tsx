'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ChatMessage from '@/components/ChatMessage';
import TypingIndicator from '@/components/TypingIndicator';
import { parseChartFromResponse } from '@/lib/parseChart';
import type { ChartData } from '@/lib/parseChart';
import { fetchDataForQuestion } from '@/lib/questionRouter';

const SUGGESTED_QUESTIONS = [
  'Who are our top performing agents this month?',
  'Show me all hot leads right now',
  'Which customers haven\'t been followed up on?',
  'What are customers mostly inquiring about?',
  'How is our team\'s sentiment score?',
  'Which agent has the most hot leads?',
  'Show me a breakdown of deal stages',
  'Who are our most active customers?',
  'What products are customers most interested in?',
  'Which follow-ups are urgent today?',
];

const MAX_MESSAGES = 10;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chartData?: ChartData | null;
  timestamp: Date;
}

function buildHistory(messages: Message[]): { role: 'user' | 'assistant'; content: string }[] {
  const pairs: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const msg of messages) {
    pairs.push({ role: msg.role, content: msg.content });
  }
  return pairs.slice(-6);
}

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const submitQuestion = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), userMsg]);
    setInput('');
    setLoading(true);

    try {
      const routed = await fetchDataForQuestion(trimmed);

      if (routed.directAnswer) {
        const directMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: routed.directAnswer,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), directMsg]);
        return;
      }

      const { data, dataType, isEmpty } = routed;

      if (isEmpty) {
        const emptyMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            'Your CRM is set up correctly but doesn\'t have any data yet. Once WhatsApp messages start coming in and the pipeline processes them, I\'ll be able to answer your questions. The AI pipeline runs every 6 hours — check back after the first run.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), emptyMsg]);
        return;
      }

      const history = buildHistory(messages);

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          data,
          dataType,
          history,
        }),
      });

      if (!res.ok) {
        throw new Error('API error');
      }

      const { answer } = await res.json();
      const { chartData, cleanText } = parseChartFromResponse(answer);

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: cleanText,
        chartData,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), aiMsg]);
    } catch {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'I couldn\'t process that question right now. Please try again in a moment.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuestion(input);
  };

  const handleChipClick = (q: string) => {
    setInput(q);
    submitQuestion(q);
  };

  return (
    <div className="ask-container">
      <Link href="/" className="ask-back-link">
        ← Back to Dashboard
      </Link>

      <header className="ask-header">
        <h1>AHL CRM — Ask Anything</h1>
        <p>Powered by AI · Data updated every 6 hours</p>
      </header>

      <div className="ask-messages">
        {messages.length === 0 && !loading && (
          <div className="ask-welcome">
            Ask anything about your sales team, customers, leads, or follow-ups.
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            chartData={msg.chartData}
            timestamp={msg.timestamp}
          />
        ))}

        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <form className="ask-input-row" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="ask-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your CRM..."
          disabled={loading}
          autoFocus
        />
        <button className="ask-button" type="submit" disabled={loading || !input.trim()}>
          Ask
        </button>
      </form>

      <p className="ask-suggestions-label">Suggested:</p>
      <div className="ask-chips">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            className="ask-chip"
            onClick={() => handleChipClick(q)}
            disabled={loading}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
