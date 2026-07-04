'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CustomerProfile } from '@/lib/supabase';
import CustomerProfilePanel from './CustomerProfilePanel';

interface Props {
  profiles: CustomerProfile[];
}

function stageClass(stage: string | null): string {
  if (stage === 'hot') return 'stage-hot';
  if (stage === 'warm') return 'stage-warm';
  return 'stage-cold';
}

export default function CustomersTable({ profiles }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<CustomerProfile | null>(null);
  const [search, setSearch] = useState(params.get('q') || '');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (search.trim()) p.set('q', search.trim());
    router.push(`/customers?${p.toString()}`);
  }

  return (
    <>
      <form className="search-form" onSubmit={handleSearch}>
        <div className="search-row">
          <input
            type="text"
            placeholder="Search by name, product, or summary keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">Search</button>
        </div>
      </form>

      {profiles.length === 0 ? (
        <p className="empty">No customer profiles yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Last Active</th>
                <th>Deal Stage</th>
                <th>Sentiment</th>
                <th>Total Chats</th>
                <th>Hot Count</th>
                <th>Products</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.contact_name || '—'}</td>
                  <td>
                    {p.last_active
                      ? new Date(p.last_active).toLocaleDateString('en-IN')
                      : '—'}
                  </td>
                  <td>
                    <span className={`stage-badge ${stageClass(p.current_deal_stage)}`}>
                      {p.current_deal_stage || '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`sentiment-pill sentiment-${p.overall_sentiment}`}>
                      {p.overall_sentiment || '—'}
                    </span>
                  </td>
                  <td>{p.total_chats}</td>
                  <td className="hot-cell">{p.hot_lead_count}</td>
                  <td className="summary-cell">{p.products_interested || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-profile"
                      onClick={() => setSelected(p)}
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <CustomerProfilePanel
          profile={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
