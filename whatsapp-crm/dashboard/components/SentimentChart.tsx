interface Props {
  breakdown: Record<string, number>;
}

const SENTIMENTS = [
  { key: 'positive', label: 'Positive', className: 'sentiment-positive' },
  { key: 'neutral',  label: 'Neutral',  className: 'sentiment-neutral' },
  { key: 'negative', label: 'Negative', className: 'sentiment-negative' },
] as const;

export default function SentimentChart({ breakdown }: Props) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="sentiment-chart">
      {SENTIMENTS.map(({ key, label, className }) => {
        const count = breakdown[key] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={key} className="sentiment-row">
            <span className={`sentiment-pill ${className}`}>{label}</span>
            <div className="bar-track">
              <div className={`bar-fill ${className}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="sentiment-count">{count} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}
