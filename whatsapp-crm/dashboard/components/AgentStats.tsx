import { AgentPerformance } from '@/lib/supabase';

interface Props {
  agents: AgentPerformance[];
}

function rateClass(rate: number): string {
  if (rate > 20) return 'rate-good';
  if (rate >= 10) return 'rate-amber';
  return 'rate-bad';
}

export default function AgentStats({ agents }: Props) {
  if (agents.length === 0) {
    return <p className="empty">No agent data yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Total Chats</th>
            <th>Hot</th>
            <th>Warm</th>
            <th>Cold</th>
            <th>Hot Lead Rate</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.agent_name ?? 'unknown'}>
              <td>{agent.agent_name || 'Unknown'}</td>
              <td>{agent.total_chats}</td>
              <td className="hot-cell">{agent.hot_leads}</td>
              <td>{agent.warm_leads}</td>
              <td>{agent.cold_leads}</td>
              <td>
                <span className={`rate-badge ${rateClass(agent.hot_lead_rate)}`}>
                  {agent.hot_lead_rate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
