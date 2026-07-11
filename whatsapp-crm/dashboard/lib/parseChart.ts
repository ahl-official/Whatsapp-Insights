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

  // Ignore empty / all-zero series (model sometimes emits a placeholder chart)
  if (data.length === 0) return null;
  if (data.every((d) => d.value === 0)) return null;

  return { type: type as ChartData['type'], title, data };
}

function tryParseChartPayload(raw: string): ChartData | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;
  try {
    return normalizeChart(JSON.parse(jsonText));
  } catch {
    return null;
  }
}

/** Strip leftover chart JSON / fences the model dumps outside <chart> tags */
function stripOrphanChartJson(text: string): string {
  let clean = text;
  clean = clean.replace(/```(?:json)?[\s\S]*?```/gi, (block) => {
    return tryParseChartPayload(block) ? '' : block;
  });
  clean = clean.replace(
    /\{[\s\S]*?"type"\s*:\s*"(?:bar|pie|line)"[\s\S]*?"data"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/gi,
    (block) => (tryParseChartPayload(block) ? '' : block)
  );
  // Cleanup labels the model sometimes leaves behind
  clean = clean.replace(/\n?\s*\*{0,2}Chart:\*{0,2}\s*$/gim, '');
  return clean.replace(/\n{3,}/g, '\n\n').trim();
}

export function parseChartFromResponse(text: string): {
  chartData: ChartData | null;
  cleanText: string;
} {
  const chartMatch = text.match(/<chart>([\s\S]*?)<\/chart>/i);
  if (chartMatch) {
    const chartData = tryParseChartPayload(chartMatch[1]);
    let cleanText = text.replace(/<chart>[\s\S]*?<\/chart>/gi, '').trim();
    cleanText = stripOrphanChartJson(cleanText);
    if (chartData) return { chartData, cleanText };
    return { chartData: null, cleanText: cleanText || stripOrphanChartJson(text) };
  }

  // Fallback: model forgot <chart> tags but emitted a fenced / raw chart object
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    const chartData = tryParseChartPayload(fenceMatch[1]);
    if (chartData) {
      const cleanText = stripOrphanChartJson(text.replace(fenceMatch[0], ''));
      return { chartData, cleanText };
    }
  }

  const rawObjMatch = text.match(
    /\{[\s\S]*?"type"\s*:\s*"(?:bar|pie|line)"[\s\S]*?"data"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/
  );
  if (rawObjMatch) {
    const chartData = tryParseChartPayload(rawObjMatch[0]);
    if (chartData) {
      const cleanText = stripOrphanChartJson(text.replace(rawObjMatch[0], ''));
      return { chartData, cleanText };
    }
  }

  return { chartData: null, cleanText: text };
}
