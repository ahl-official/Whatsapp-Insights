import ReportGenerator from './ReportGenerator';
import { fetchAgentNames } from '@/lib/reportData';
import './reports.css';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  let agents: string[] = [];
  let loadError: string | null = null;

  try {
    agents = await fetchAgentNames();
  } catch {
    loadError = 'Failed to load agents. Please refresh and try again.';
  }

  return (
    <div>
      {loadError ? (
        <div className="report-error">{loadError}</div>
      ) : (
        <ReportGenerator agents={agents} />
      )}
    </div>
  );
}
