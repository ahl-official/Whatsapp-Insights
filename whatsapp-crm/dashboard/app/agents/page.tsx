import AgentStats from '@/components/AgentStats';
import { getAgentPerformance } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const agents = await getAgentPerformance();

  return (
    <div>
      <h1 className="page-title">Agent Performance</h1>
      <AgentStats agents={agents} />
    </div>
  );
}
