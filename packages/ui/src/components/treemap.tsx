import type { GroupRollup } from '@beacon-report/shared';
import { Link } from '@tanstack/react-router';

/**
 * Squarified treemap of spec files: area = test count, color = pass rate.
 * Laid out in a normalized 100×100 space and rendered as percent-positioned
 * links, so it scales with the card.
 */

interface Item {
  name: string;
  value: number;
  rate: number;
}

interface Rect extends Item {
  x: number;
  y: number;
  w: number;
  h: number;
}

function worstRatio(row: Item[], side: number, total: number, area: number): number {
  const rowArea = (row.reduce((s, i) => s + i.value, 0) / total) * area;
  const rowSide = rowArea / side;
  let worst = 0;
  for (const item of row) {
    const itemArea = (item.value / total) * area;
    const other = itemArea / rowSide;
    worst = Math.max(worst, rowSide / other, other / rowSide);
  }
  return worst;
}

function layoutRow(
  row: Item[],
  rect: { x: number; y: number; w: number; h: number },
  total: number,
  area: number,
) {
  const rects: Rect[] = [];
  const rowArea = (row.reduce((s, i) => s + i.value, 0) / total) * area;
  const horizontal = rect.w >= rect.h;
  const side = horizontal ? rect.h : rect.w;
  const thickness = side > 0 ? rowArea / side : 0;
  let offset = 0;
  for (const item of row) {
    const itemArea = (item.value / total) * area;
    const length = thickness > 0 ? itemArea / thickness : 0;
    rects.push(
      horizontal
        ? { ...item, x: rect.x, y: rect.y + offset, w: thickness, h: length }
        : { ...item, x: rect.x + offset, y: rect.y, w: length, h: thickness },
    );
    offset += length;
  }
  const next = horizontal
    ? { x: rect.x + thickness, y: rect.y, w: rect.w - thickness, h: rect.h }
    : { x: rect.x, y: rect.y + thickness, w: rect.w, h: rect.h - thickness };
  return { rects, next };
}

export function squarify(items: Item[]): Rect[] {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, i) => s + i.value, 0);
  if (total === 0) return [];
  const out: Rect[] = [];
  let rect = { x: 0, y: 0, w: 100, h: 100 };
  let row: Item[] = [];
  for (const item of sorted) {
    const side = Math.min(rect.w, rect.h);
    if (
      row.length === 0 ||
      worstRatio([...row, item], side, total, 100 * 100) <= worstRatio(row, side, total, 100 * 100)
    ) {
      row.push(item);
      continue;
    }
    const laid = layoutRow(row, rect, total, 100 * 100);
    out.push(...laid.rects);
    rect = laid.next;
    row = [item];
  }
  if (row.length > 0) out.push(...layoutRow(row, rect, total, 100 * 100).rects);
  return out;
}

function rateClasses(rate: number): string {
  if (rate >= 95) return 'bg-passed-tint text-passed-text';
  if (rate >= 80) return 'bg-flaky-tint text-flaky-text';
  return 'bg-failed-tint text-failed-text';
}

export function FileTreemap({ files }: { files: GroupRollup[] }) {
  const rects = squarify(
    files.map((f) => ({
      name: f.name,
      value: f.total,
      rate: f.total === 0 ? 100 : ((f.expected + f.flaky) / f.total) * 100,
    })),
  );
  if (rects.length === 0)
    return <div className="mt-3 text-[13px] text-ink-3">No files recorded.</div>;
  return (
    <div className="relative mt-3 h-56 overflow-hidden rounded-[10px]">
      {rects.map((r) => (
        <Link
          key={r.name}
          to="/tests"
          search={{ q: r.name }}
          title={`${r.name} — ${r.value} tests · ${Math.round(r.rate)}% pass`}
          className={`absolute flex flex-col justify-end overflow-hidden border border-card p-1.5 ${rateClasses(r.rate)}`}
          style={{
            left: `${r.x}%`,
            top: `${r.y}%`,
            width: `${r.w}%`,
            height: `${r.h}%`,
          }}
        >
          <span className="truncate font-mono text-[10px] leading-tight">{r.name}</span>
          <span className="text-[10px] font-semibold leading-tight">
            {r.value} · {Math.round(r.rate)}%
          </span>
        </Link>
      ))}
    </div>
  );
}
