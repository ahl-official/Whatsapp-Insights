import { Suspense } from 'react';
import SearchBar from '@/components/SearchBar';
import { searchInsights } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: {
    q?: string;
    contact?: string;
    agent?: string;
    stage?: string;
    sentiment?: string;
    from?: string;
    to?: string;
  };
}

async function SearchResults({ searchParams }: Props) {
  const hasFilters = Object.values(searchParams).some(Boolean);

  if (!hasFilters) {
    return <p className="empty">Use the filters above to search chat history.</p>;
  }

  const results = await searchInsights({
    query:     searchParams.q,
    contact:   searchParams.contact,
    agent:     searchParams.agent,
    dealStage: searchParams.stage,
    sentiment: searchParams.sentiment,
    dateFrom:  searchParams.from,
    dateTo:    searchParams.to,
  });

  if (results.length === 0) {
    return <p className="empty">No results found.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Contact</th>
            <th>Agent</th>
            <th>Intent</th>
            <th>Sentiment</th>
            <th>Stage</th>
            <th>Follow-Up</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={row.id}>
              <td>{row.chat_date ? new Date(row.chat_date).toLocaleDateString('en-IN') : '—'}</td>
              <td>{row.contact_name || '—'}</td>
              <td>{row.agent_name || '—'}</td>
              <td>{row.customer_intent || '—'}</td>
              <td>
                <span className={`sentiment-pill sentiment-${row.sentiment}`}>
                  {row.sentiment || '—'}
                </span>
              </td>
              <td>
                <span className={`badge badge-${row.deal_stage}`}>
                  {row.deal_stage || '—'}
                </span>
              </td>
              <td>{row.follow_up_action || '—'}</td>
              <td className="summary-cell">{row.key_summary || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SearchPage({ searchParams }: Props) {
  return (
    <div>
      <h1 className="page-title">Search History</h1>
      <Suspense fallback={<p className="empty">Loading...</p>}>
        <SearchBar />
      </Suspense>
      <SearchResults searchParams={searchParams} />
    </div>
  );
}
