'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery]       = useState(params.get('q') || '');
  const [contact, setContact]   = useState(params.get('contact') || '');
  const [agent, setAgent]       = useState(params.get('agent') || '');
  const [dealStage, setDealStage] = useState(params.get('stage') || '');
  const [sentiment, setSentiment] = useState(params.get('sentiment') || '');
  const [dateFrom, setDateFrom] = useState(params.get('from') || '');
  const [dateTo, setDateTo]     = useState(params.get('to') || '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query)     p.set('q', query);
    if (contact)   p.set('contact', contact);
    if (agent)     p.set('agent', agent);
    if (dealStage) p.set('stage', dealStage);
    if (sentiment) p.set('sentiment', sentiment);
    if (dateFrom)  p.set('from', dateFrom);
    if (dateTo)    p.set('to', dateTo);
    router.push(`/search?${p.toString()}`);
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-row">
        <input
          type="text"
          placeholder="Keyword in summary..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <input
          type="text"
          placeholder="Contact name..."
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <input
          type="text"
          placeholder="Agent name..."
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
        />
      </div>
      <div className="search-row">
        <select value={dealStage} onChange={(e) => setDealStage(e.target.value)}>
          <option value="">All deal stages</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        <select value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
          <option value="">All sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button type="submit">Search</button>
      </div>
    </form>
  );
}
