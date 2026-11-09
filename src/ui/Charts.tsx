import { useId } from 'react';

export interface LinePoint {
  label: string;
  value: number;
  /** Short annotation shown on the last point, e.g. "30×9". */
  tip?: string;
}

/**
 * Accessible SVG line chart. Only real data points are drawn; the caller is
 * responsible for empty-state handling when there are fewer than two points.
 */
export function LineChart({ points, title, unit, height = 180 }: { points: LinePoint[]; title: string; unit: string; height?: number }) {
  const gradId = useId().replace(/:/g, '');
  const width = 340;
  const pad = { l: 34, r: 16, t: 26, b: 26 };
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min = Math.floor(min - span * 0.15);
  max = Math.ceil(max + span * 0.15);
  const x = (i: number) => pad.l + (points.length === 1 ? (width - pad.l - pad.r) / 2 : (i * (width - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b);
  const ticks = [0, 0.5, 1].map((t) => Math.round((min + t * (max - min)) * 10) / 10);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height - pad.b} L${x(0).toFixed(1)},${height - pad.b} Z`;
  const last = points[points.length - 1]!;
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));
  const tipText = last.tip ?? String(last.value);
  const tipW = Math.max(30, tipText.length * 7 + 12);
  return (
    <figure>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${p.value} ${unit}`).join(', ')}`}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className="area-stop-top" />
            <stop offset="100%" className="area-stop-bottom" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {points.length > 1 && <path d={area} fill={`url(#${gradId})`} />}
        {points.length > 1 && <path className="line" d={line} />}
        {points.map((p, i) => (
          <circle key={i} className={i === points.length - 1 ? 'dot-last' : 'dot'} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3.5} />
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={`l${i}`} x={x(i)} y={height - 6} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
        <g transform={`translate(${Math.min(width - pad.r - tipW, Math.max(pad.l, x(points.length - 1) - tipW / 2))},${Math.max(2, y(last.value) - 26)})`}>
          <rect className="tip" width={tipW} height={18} rx={5} />
          <text className="tip-text" x={tipW / 2} y={13} textAnchor="middle">
            {tipText}
          </text>
        </g>
      </svg>
    </figure>
  );
}

export interface WeekBar {
  label: string;
  completed: number;
  target: number;
}

/** Planned (dashed outline) vs completed (blue ink) sessions per week. */
export function WeekBars({ weeks, title }: { weeks: WeekBar[]; title: string }) {
  const width = 340;
  const height = 150;
  const pad = { l: 20, r: 8, t: 12, b: 24 };
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.completed, w.target)));
  const bw = (width - pad.l - pad.r) / weeks.length;
  const h = (v: number) => (v / max) * (height - pad.t - pad.b);
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: ${weeks.map((w) => `${w.label} ${w.completed} of ${w.target}`).join(', ')}`}>
      {weeks.map((w, i) => {
        const x = pad.l + i * bw + bw * 0.18;
        const wd = bw * 0.64;
        return (
          <g key={w.label + i}>
            {w.target > 0 && <rect className="bar-target" x={x} width={wd} y={height - pad.b - h(w.target)} height={h(w.target)} rx={4} />}
            <rect className={w.target > 0 && w.completed >= w.target ? 'bar-done' : 'bar'} x={x + 3} width={wd - 6} y={height - pad.b - h(w.completed)} height={h(w.completed)} rx={3} />
            <text x={x + wd / 2} y={height - 8} textAnchor="middle">
              {w.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
