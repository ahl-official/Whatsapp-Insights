import HotLeadsTable from '@/components/HotLeadsTable';
import SentimentChart from '@/components/SentimentChart';
import {
  getWeeklyChatCount,
  getHotLeadsCount,
  getSentimentBreakdown,
  getUrgentFollowUps,
  getRecentHotLeads,
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const [weeklyCount, hotCount, sentiment, urgent, hotLeads] = await Promise.all([
    getWeeklyChatCount(),
    getHotLeadsCount(),
    getSentimentBreakdown(),
    getUrgentFollowUps(),
    getRecentHotLeads(20),
  ]);

  return (
    <div>
      <h1 className="page-title">Overview</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Chats This Week</div>
          <div className="stat-value">{weeklyCount}</div>
        </div>
        <div className="stat-card hot">
          <div className="stat-label">Hot Leads</div>
          <div className="stat-value hot">{hotCount}</div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Sentiment Breakdown</h2>
        <SentimentChart breakdown={sentiment} />
      </div>

      {urgent.length > 0 && (
        <div className="section">
          <h2 className="section-title">Follow-ups Due Today</h2>
          <ul className="urgent-list">
            {urgent.map((item) => (
              <li key={item.id} className="urgent-item">
                <div>
                  <div className="urgent-contact">{item.contact_name}</div>
                  <div className="urgent-action">{item.follow_up_action}</div>
                </div>
                <span className="badge badge-hot">urgent</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Recent Hot Leads</h2>
        <HotLeadsTable leads={hotLeads} />
      </div>
    </div>
  );
}
