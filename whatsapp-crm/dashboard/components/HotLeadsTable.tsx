'use client';

import { useState } from 'react';
import { HotLead, getProfileByChatId, CustomerProfile } from '@/lib/supabase';
import CustomerProfilePanel from './CustomerProfilePanel';

interface Props {
  leads: HotLead[];
}

export default function HotLeadsTable({ leads }: Props) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  async function viewProfile(chatId: string) {
    setPanelOpen(true);
    setLoading(true);
    setProfile(null);
    try {
      const data = await getProfileByChatId(chatId);
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  function closePanel() {
    setPanelOpen(false);
    setProfile(null);
  }

  if (leads.length === 0) {
    return <p className="empty">No hot leads yet.</p>;
  }

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contact</th>
              <th>Agent</th>
              <th>Intent</th>
              <th>Deadline</th>
              <th>Summary</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>{lead.contact_name || '—'}</td>
                <td>{lead.agent_name || '—'}</td>
                <td>{lead.customer_intent || '—'}</td>
                <td>
                  <span className={`badge badge-${lead.follow_up_deadline === 'urgent (today)' ? 'hot' : 'warm'}`}>
                    {lead.follow_up_deadline || '—'}
                  </span>
                </td>
                <td className="summary-cell">{lead.key_summary || '—'}</td>
                <td>
                  <button
                    type="button"
                    className="btn-profile"
                    onClick={() => viewProfile(lead.chat_id)}
                  >
                    View Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {panelOpen && (
        <CustomerProfilePanel
          profile={profile}
          loading={loading}
          onClose={closePanel}
        />
      )}
    </>
  );
}
