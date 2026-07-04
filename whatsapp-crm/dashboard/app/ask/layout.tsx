import type { Metadata } from 'next';
import './ask.css';

export const metadata: Metadata = {
  title: 'Ask AI — AHL CRM',
  description: 'Ask anything about your WhatsApp CRM data',
};

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return <div className="ask-page">{children}</div>;
}
