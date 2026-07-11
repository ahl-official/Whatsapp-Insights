'use client';

import { useMemo, useState } from 'react';
import {
  buildReportStats,
  calculateScore,
  fetchAgentInsights,
  isFollowedUp,
  type AgentScore,
  type ReportInsight,
  type ReportStats,
} from '@/lib/reportData';
import ReportPDF from './ReportPDF';

const SCORE_CATEGORIES: {
  key: keyof Pick<AgentScore, 'sentiment' | 'followUp' | 'hotLeadConversion' | 'responseQuality'>;
  label: string;
}[] = [
  { key: 'sentiment', label: 'Sentiment' },
  { key: 'followUp', label: 'Follow-up' },
  { key: 'hotLeadConversion', label: 'Hot Leads' },
  { key: 'responseQuality', label: 'Response' },
];

interface ReportGeneratorProps {
  agents: string[];
}

function formatDisplayDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export default function ReportGenerator({ agents }: ReportGeneratorProps) {
  const [agentName, setAgentName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [insights, setInsights] = useState<ReportInsight[] | null>(null);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [score, setScore] = useState<AgentScore | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');

  const canGenerate = Boolean(agentName && fromDate && toDate && !loading);

  const fileName = useMemo(() => {
    const safeAgent = (agentName || 'Agent').replace(/[^\w\-]+/g, '_');
    return `AHL-Report-${safeAgent}-${fromDate}-${toDate}.pdf`;
  }, [agentName, fromDate, toDate]);

  async function handleGenerate() {
    setError(null);
    setPdfError(null);
    setInsights(null);
    setStats(null);
    setScore(null);

    if (!agentName || !fromDate || !toDate) {
      setError('Select an agent and date range to generate a report');
      return;
    }

    if (fromDate > toDate) {
      setError('End date must be after start date.');
      return;
    }

    setLoading(true);
    try {
      const rows = await fetchAgentInsights(agentName, fromDate, toDate);
      setInsights(rows);
      setStats(buildReportStats(rows));
      setScore(calculateScore(rows));
      setGeneratedAt(
        new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    } catch {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPdf() {
    if (!insights || !stats || !score) return;
    setPdfError(null);
    setPdfLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const blob = await pdf(
        <ReportPDF
          agentName={agentName}
          fromDate={fromDate}
          toDate={toDate}
          generatedAt={generatedAt}
          insights={insights}
          stats={stats}
          score={score}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError('PDF download failed. Try again or contact support.');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="report-page">
      <div className="report-intro">
        <h1 className="page-title">📊 Agent Performance Report</h1>
        <p className="report-subtitle">
          Generate detailed PDF reports per agent for the process coordinator
        </p>
      </div>

      <div className="report-form">
        <label className="report-field">
          <span>Select Agent</span>
          <select
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            disabled={loading}
          >
            <option value="">Choose an agent…</option>
            {agents.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="report-field">
          <span>From Date</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="report-field">
          <span>To Date</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            disabled={loading}
          />
        </label>

        <button
          type="button"
          className="report-btn"
          onClick={handleGenerate}
          disabled={!canGenerate}
        >
          {loading ? 'Generating…' : 'Generate Report'}
        </button>
      </div>

      {error && <div className="report-error">{error}</div>}
      {pdfError && <div className="report-error">{pdfError}</div>}

      {loading && (
        <div className="report-skeleton">
          <div className="report-skel-line" />
          <div className="report-skel-line short" />
          <div className="report-skel-grid">
            <div className="report-skel-card" />
            <div className="report-skel-card" />
            <div className="report-skel-card" />
            <div className="report-skel-card" />
          </div>
        </div>
      )}

      {!loading && !insights && !error && (
        <div className="report-empty">
          Select an agent and date range to generate a report
        </div>
      )}

      {!loading && insights && stats && insights.length === 0 && (
        <div className="report-empty">
          No customer interactions found for {agentName} in this period.
        </div>
      )}

      {!loading && insights && stats && score && insights.length > 0 && (
        <div className="report-preview">
          <div className="report-preview-header">
            <div>
              <h2>AHL CRM — Agent Performance Report</h2>
              <p>
                Agent: <strong>{agentName}</strong>
              </p>
              <p>
                Period: {fromDate} to {toDate}
              </p>
              <p>Generated: {generatedAt}</p>
            </div>
            <div className="report-download">
              <button
                type="button"
                className="report-btn report-btn-secondary"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
              >
                {pdfLoading ? 'Preparing PDF…' : 'Download PDF'}
              </button>
            </div>
          </div>

          <section className="score-card" style={{ borderColor: score.color }}>
            <h3 className="score-card-eyebrow">Performance Score</h3>
            <div className="score-card-main">
              <div className="score-number" style={{ color: score.color }}>
                {score.total}
                <span className="score-number-max"> / 100</span>
              </div>
              <span className="score-grade-pill" style={{ background: score.color }}>
                Grade: {score.grade} — {score.label}
              </span>
            </div>
            <div className="score-bars">
              {SCORE_CATEGORIES.map(({ key, label }) => {
                const value = score[key];
                const pct = Math.min(100, Math.max(0, (value / 25) * 100));
                return (
                  <div key={key} className="score-bar-row">
                    <span className="score-bar-label">{label}</span>
                    <div className="score-bar-track">
                      <div
                        className="score-bar-fill"
                        style={{ width: `${pct}%`, background: score.color }}
                      />
                    </div>
                    <span className="score-bar-value">
                      {value.toFixed(1)} / 25
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="score-card-meta">
              Period: {formatDisplayDate(fromDate)} — {formatDisplayDate(toDate)}
            </p>
            <p className="score-card-meta">
              Based on {insights.length} customer interaction
              {insights.length === 1 ? '' : 's'}
            </p>
          </section>

          <section className="section">
            <h3 className="section-title">Summary Stats</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Chats</div>
                <div className="stat-value">{stats.totalChats}</div>
              </div>
              <div className="stat-card hot">
                <div className="stat-label">Hot Leads</div>
                <div className="stat-value hot">{stats.hotLeads}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Follow-ups On Time</div>
                <div className="stat-value">{stats.followUpsOnTime}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Avg Positive Sentiment</div>
                <div className="stat-value">{stats.positivePercent}%</div>
              </div>
            </div>
          </section>

          <section className="section">
            <h3 className="section-title">Deal Stage Breakdown</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Count</th>
                    <th>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.dealStages.map((row) => (
                    <tr key={row.stage}>
                      <td>
                        <span className={`badge badge-${row.stage.toLowerCase()}`}>
                          {row.stage}
                        </span>
                      </td>
                      <td>{row.count}</td>
                      <td>{row.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <h3 className="section-title">Customer Interactions</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer Name</th>
                    <th>Intent</th>
                    <th>Sentiment</th>
                    <th>Deal Stage</th>
                    <th>Follow-Up Action</th>
                    <th>Deadline</th>
                    <th>Followed Up?</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.map((insight) => (
                    <tr key={insight.id}>
                      <td>{formatDisplayDate(insight.chat_date)}</td>
                      <td>{insight.contact_name ?? 'Unknown'}</td>
                      <td>{insight.customer_intent ?? '—'}</td>
                      <td>{insight.sentiment ?? '—'}</td>
                      <td>{insight.deal_stage ?? '—'}</td>
                      <td>{insight.follow_up_action ?? '—'}</td>
                      <td>{insight.follow_up_deadline ?? '—'}</td>
                      <td>{isFollowedUp(insight) ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="report-disclaimer">
              Follow-up compliance is AI-estimated. Urgent same-day follow-ups are flagged
              for manual review.
            </p>
          </section>

          <section className="section">
            <h3 className="section-title">AI Insights Summary</h3>
            <ul className="report-bullets">
              {insights
                .filter((i) => i.key_summary)
                .map((insight) => (
                  <li key={`sum-${insight.id}`}>
                    <strong>{insight.contact_name ?? 'Unknown'}</strong> (
                    {formatDisplayDate(insight.chat_date)}): {insight.key_summary}
                  </li>
                ))}
            </ul>
            {insights.every((i) => !i.key_summary) && (
              <p className="empty">No AI summaries available for this period.</p>
            )}
          </section>

          <section className="section">
            <h3 className="section-title">Performance Notes</h3>
            {stats.performanceNotes.map((note) => (
              <p key={note} className="report-note">
                {note}
              </p>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
