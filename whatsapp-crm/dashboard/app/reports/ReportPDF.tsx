'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { AgentScore, ReportInsight, ReportStats } from '@/lib/reportData';
import { isFollowedUp } from '@/lib/reportData';

export interface ReportPDFProps {
  agentName: string;
  fromDate: string;
  toDate: string;
  generatedAt: string;
  insights: ReportInsight[];
  stats: ReportStats;
  score: AgentScore;
}

const SCORE_ROWS: {
  key: keyof Pick<AgentScore, 'sentiment' | 'followUp' | 'hotLeadConversion' | 'responseQuality'>;
  label: string;
}[] = [
  { key: 'sentiment', label: 'Sentiment' },
  { key: 'followUp', label: 'Follow-up' },
  { key: 'hotLeadConversion', label: 'Hot Leads' },
  { key: 'responseQuality', label: 'Response' },
];

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#0f172a',
    padding: 16,
    marginBottom: 18,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  headerMeta: {
    color: '#cbd5e1',
    fontSize: 9,
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#6366f1',
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
  },
  scoreBox: {
    borderWidth: 1.5,
    borderRadius: 6,
    padding: 14,
    marginBottom: 4,
    backgroundColor: '#f8fafc',
  },
  scoreEyebrow: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  scoreMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  scoreNumber: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
  },
  scoreMax: {
    fontSize: 12,
    color: '#64748b',
  },
  gradePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  scoreBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  scoreBarLabel: {
    width: '22%',
    fontSize: 8,
    color: '#334155',
  },
  scoreBarTrack: {
    width: '55%',
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 8,
    borderRadius: 4,
  },
  scoreBarValue: {
    width: '23%',
    fontSize: 8,
    color: '#475569',
    textAlign: 'right',
  },
  scoreMeta: {
    marginTop: 8,
    fontSize: 8,
    color: '#64748b',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#f8fafc',
  },
  statLabel: {
    fontSize: 7,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  th: {
    color: '#ffffff',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    padding: 5,
  },
  td: {
    fontSize: 7,
    padding: 5,
    color: '#334155',
  },
  hot: { color: '#ef4444' },
  warm: { color: '#f97316' },
  cold: { color: '#6b7280' },
  positive: { color: '#22c55e' },
  neutral: { color: '#f59e0b' },
  negative: { color: '#ef4444' },
  bullet: {
    marginBottom: 4,
    fontSize: 8,
    lineHeight: 1.4,
    color: '#334155',
  },
  note: {
    fontSize: 8,
    lineHeight: 1.5,
    color: '#334155',
    marginBottom: 4,
  },
  disclaimer: {
    marginTop: 10,
    fontSize: 7,
    color: '#64748b',
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8',
  },
});

function formatDate(value: string | null): string {
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

function stageStyle(stage: string | null) {
  if (stage === 'hot') return styles.hot;
  if (stage === 'warm') return styles.warm;
  return styles.cold;
}

function sentimentStyle(sentiment: string | null) {
  if (sentiment === 'positive') return styles.positive;
  if (sentiment === 'negative') return styles.negative;
  return styles.neutral;
}

export default function ReportPDF({
  agentName,
  fromDate,
  toDate,
  generatedAt,
  insights,
  stats,
  score,
}: ReportPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AHL CRM — Agent Performance Report</Text>
          <Text style={styles.headerMeta}>Agent: {agentName}</Text>
          <Text style={styles.headerMeta}>
            Period: {fromDate} to {toDate}
          </Text>
          <Text style={styles.headerMeta}>Generated: {generatedAt}</Text>
        </View>

        <Text style={styles.sectionTitle}>Performance Score</Text>
        <View style={[styles.scoreBox, { borderColor: score.color }]}>
          <Text style={styles.scoreEyebrow}>Performance Score</Text>
          <View style={styles.scoreMain}>
            <Text style={[styles.scoreNumber, { color: score.color }]}>
              {score.total}
              <Text style={styles.scoreMax}> / 100</Text>
            </Text>
            <Text style={[styles.gradePill, { backgroundColor: score.color }]}>
              Grade: {score.grade} — {score.label}
            </Text>
          </View>
          {SCORE_ROWS.map(({ key, label }) => {
            const value = score[key];
            const pct = Math.min(100, Math.max(0, (value / 25) * 100));
            return (
              <View key={key} style={styles.scoreBarRow}>
                <Text style={styles.scoreBarLabel}>{label}</Text>
                <View style={styles.scoreBarTrack}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      { width: `${pct}%`, backgroundColor: score.color },
                    ]}
                  />
                </View>
                <Text style={styles.scoreBarValue}>
                  {value.toFixed(1)} / 25
                </Text>
              </View>
            );
          })}
          <Text style={styles.scoreMeta}>
            Based on {insights.length} interaction{insights.length === 1 ? '' : 's'} from{' '}
            {formatDate(fromDate)} to {formatDate(toDate)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>1. Summary Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Chats</Text>
            <Text style={styles.statValue}>{stats.totalChats}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Hot Leads</Text>
            <Text style={[styles.statValue, styles.hot]}>{stats.hotLeads}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Follow-ups On Time</Text>
            <Text style={styles.statValue}>{stats.followUpsOnTime}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Avg Positive Sentiment</Text>
            <Text style={styles.statValue}>{stats.positivePercent}%</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>2. Deal Stage Breakdown</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: '40%' }]}>Stage</Text>
            <Text style={[styles.th, { width: '30%' }]}>Count</Text>
            <Text style={[styles.th, { width: '30%' }]}>% of Total</Text>
          </View>
          {stats.dealStages.map((row, i) => (
            <View
              key={row.stage}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.td, { width: '40%' }, stageStyle(row.stage.toLowerCase())]}>
                {row.stage}
              </Text>
              <Text style={[styles.td, { width: '30%' }]}>{row.count}</Text>
              <Text style={[styles.td, { width: '30%' }]}>{row.percent}%</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>3. Customer Interactions</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: '10%' }]}>Date</Text>
            <Text style={[styles.th, { width: '14%' }]}>Customer</Text>
            <Text style={[styles.th, { width: '16%' }]}>Intent</Text>
            <Text style={[styles.th, { width: '10%' }]}>Sentiment</Text>
            <Text style={[styles.th, { width: '10%' }]}>Stage</Text>
            <Text style={[styles.th, { width: '18%' }]}>Follow-Up</Text>
            <Text style={[styles.th, { width: '12%' }]}>Deadline</Text>
            <Text style={[styles.th, { width: '10%' }]}>Done?</Text>
          </View>
          {insights.map((insight, i) => (
            <View
              key={insight.id}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              wrap={false}
            >
              <Text style={[styles.td, { width: '10%' }]}>{formatDate(insight.chat_date)}</Text>
              <Text style={[styles.td, { width: '14%' }]}>
                {insight.contact_name ?? 'Unknown'}
              </Text>
              <Text style={[styles.td, { width: '16%' }]}>
                {insight.customer_intent ?? '—'}
              </Text>
              <Text
                style={[
                  styles.td,
                  { width: '10%' },
                  sentimentStyle(insight.sentiment),
                ]}
              >
                {insight.sentiment ?? '—'}
              </Text>
              <Text
                style={[styles.td, { width: '10%' }, stageStyle(insight.deal_stage)]}
              >
                {insight.deal_stage ?? '—'}
              </Text>
              <Text style={[styles.td, { width: '18%' }]}>
                {insight.follow_up_action ?? '—'}
              </Text>
              <Text style={[styles.td, { width: '12%' }]}>
                {insight.follow_up_deadline ?? '—'}
              </Text>
              <Text style={[styles.td, { width: '10%' }]}>
                {isFollowedUp(insight) ? 'Yes' : 'No'}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.disclaimer}>
          Follow-up compliance is AI-estimated. Urgent same-day follow-ups are flagged for
          manual review.
        </Text>

        <Text style={styles.sectionTitle}>4. AI Insights Summary</Text>
        {insights
          .filter((i) => i.key_summary)
          .map((insight) => (
            <Text key={`sum-${insight.id}`} style={styles.bullet}>
              • {insight.contact_name ?? 'Unknown'} ({formatDate(insight.chat_date)}):{' '}
              {insight.key_summary}
            </Text>
          ))}
        {insights.every((i) => !i.key_summary) && (
          <Text style={styles.note}>No AI summaries available for this period.</Text>
        )}

        <Text style={styles.sectionTitle}>5. Performance Notes</Text>
        {stats.performanceNotes.map((note) => (
          <Text key={note} style={styles.note}>
            {note}
          </Text>
        ))}

        <View style={styles.footer} fixed>
          <Text>AHL CRM Agent Report — {agentName}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages} · ${generatedAt}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
