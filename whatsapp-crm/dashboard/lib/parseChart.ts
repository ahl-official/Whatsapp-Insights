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

export function parseChartFromResponse(text: string): {
  chartData: ChartData | null;
  cleanText: string;
} {
  const chartMatch = text.match(/<chart>([\s\S]*?)<\/chart>/);
  if (!chartMatch) return { chartData: null, cleanText: text };

  try {
    const chartData = JSON.parse(chartMatch[1].trim()) as ChartData;
    const cleanText = text.replace(/<chart>[\s\S]*?<\/chart>/, '').trim();
    return { chartData, cleanText };
  } catch {
    return { chartData: null, cleanText: text };
  }
}
