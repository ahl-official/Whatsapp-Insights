'use client';

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartData } from '@/lib/parseChart';

const DEFAULT_COLORS = ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#f59e0b', '#6b7280'];

const STAGE_COLORS: Record<string, string> = {
  hot: '#ef4444',
  warm: '#f97316',
  cold: '#6b7280',
  positive: '#22c55e',
  neutral: '#f59e0b',
  negative: '#ef4444',
};

function colorFor(label: string, index: number, explicit?: string): string {
  if (explicit) return explicit;
  return STAGE_COLORS[label.toLowerCase()] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

export default function CRMChart({ chart }: { chart: ChartData }) {
  const chartData = chart.data.map((d, i) => ({
    name: d.label,
    value: d.value,
    fill: colorFor(d.label, i, d.color),
  }));

  if (chart.type === 'pie') {
    return (
      <div className="crm-chart">
        <p className="crm-chart-title">{chart.title}</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) =>
                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                color: '#f1f5f9',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="crm-chart">
      <p className="crm-chart-title">{chart.title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#f1f5f9',
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
