export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartData {
  type: 'bar' | 'pie' | 'line';
  title: string;
  data: ChartDataPoint[];
}

function extractJsonObject(raw: string): string | null {
  let text = raw.trim();
  // Strip markdown fences the model sometimes wraps around JSON
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function normalizeChart(parsed: unknown): ChartData | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  let type = String(obj.type ?? '').toLowerCase().trim();
  // Model sometimes copies "bar | pie" from docs
  if (type.includes('pie') && !type.includes('bar')) type = 'pie';
  else if (type.includes('bar')) type = 'bar';
  else if (type.includes('line')) type = 'line';
  else return null;

  if (type !== 'bar' && type !== 'pie' && type !== 'line') return null;

  const title = typeof obj.title === 'string' ? obj.title : 'Chart';
  const dataRaw = Array.isArray(obj.data) ? obj.data : [];
  const data: ChartDataPoint[] = [];
  for (const row of dataRaw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const label = String(r.label ?? r.name ?? '').trim();
    const value = Number(r.value ?? r.count ?? 0);
    if (!label || Number.isNaN(value)) continue;
    const color = typeof r.color === 'string' ? r.color : undefined;
    data.push({ label, value, color });
  }

  if (data.length === 0) return null;
  return { type: type as ChartData['type'], title, data };
}

export function parseChartFromResponse(text: string): {
  chartData: ChartData | null;
  cleanText: string;
} {
  const chartMatch = text.match(/<chart>([\s\S]*?)<\/chart>/i);
  if (!chartMatch) return { chartData: null, cleanText: text };

  try {
    const jsonText = extractJsonObject(chartMatch[1]);
    if (!jsonText) return { chartData: null, cleanText: text };

    const parsed = JSON.parse(jsonText);
    const chartData = normalizeChart(parsed);
    if (!chartData) return { chartData: null, cleanText: text };

    const cleanText = text.replace(/<chart>[\s\S]*?<\/chart>/gi, '').trim();
    return { chartData, cleanText };
  } catch {
    // Still strip broken chart tags so users don't see raw markup
    const cleanText = text.replace(/<chart>[\s\S]*?<\/chart>/gi, '').trim();
    return { chartData: null, cleanText: cleanText || text };
  }
}
