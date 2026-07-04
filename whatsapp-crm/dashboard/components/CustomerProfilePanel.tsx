'use client';

import { CustomerProfile } from '@/lib/supabase';

interface Props {
  profile: CustomerProfile | null;
  onClose: () => void;
  loading?: boolean;
}

export default function CustomerProfilePanel({ profile, onClose, loading }: Props) {
  if (!profile && !loading) return null;

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-panel" onClick={(e) => e.stopPropagation()}>
        <div className="profile-panel-header">
          <h2>{profile?.contact_name || 'Customer Profile'}</h2>
          <button type="button" className="profile-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <p className="empty">Loading profile...</p>
        ) : profile ? (
          <div className="profile-panel-body">
            <div className="profile-meta">
              <span className={`badge badge-${profile.current_deal_stage}`}>
                {profile.current_deal_stage || '—'}
              </span>
              <span className={`sentiment-pill sentiment-${profile.overall_sentiment}`}>
                {profile.overall_sentiment || '—'}
              </span>
              <span className="profile-meta-item">
                {profile.total_chats} chats · {profile.hot_lead_count} hot
              </span>
            </div>

            <section className="profile-section">
              <h3>Cumulative Summary</h3>
              <p>{profile.cumulative_summary || 'No summary yet.'}</p>
            </section>

            <section className="profile-section">
              <h3>Products Interested</h3>
              <p>{profile.products_interested || '—'}</p>
            </section>

            <section className="profile-section">
              <h3>Last Purchase</h3>
              <p>{profile.last_purchase || 'No purchase recorded.'}</p>
            </section>

            <section className="profile-section">
              <h3>Key Concerns</h3>
              <p>{profile.key_concerns || '—'}</p>
            </section>

            <section className="profile-section profile-grid">
              <div>
                <h3>Preferred Agent</h3>
                <p>{profile.preferred_agent || '—'}</p>
              </div>
              <div>
                <h3>First Seen</h3>
                <p>
                  {profile.first_seen
                    ? new Date(profile.first_seen).toLocaleDateString('en-IN')
                    : '—'}
                </p>
              </div>
              <div>
                <h3>Last Active</h3>
                <p>
                  {profile.last_active
                    ? new Date(profile.last_active).toLocaleDateString('en-IN')
                    : '—'}
                </p>
              </div>
            </section>
          </div>
        ) : (
          <p className="empty">No profile found for this customer.</p>
        )}
      </div>
    </div>
  );
}
