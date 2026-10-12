import type { AttachmentRef, VisualDiff } from '@beacon-report/shared';
import { useId, useState } from 'react';
import { attachmentHref } from '../lib/attachments';

type Mode = 'slider' | 'onion' | 'diff';

/**
 * toHaveScreenshot comparison viewer: slider (wipe between actual and
 * expected), onion skin (actual fades over expected), and the pixel diff.
 */
export function VisualDiffViewer({
  diff,
  attachments,
}: {
  diff: VisualDiff;
  attachments: AttachmentRef[];
}) {
  const expected = attachmentHref(
    diff.expected !== undefined ? attachments[diff.expected] : undefined,
  );
  const actual = attachmentHref(diff.actual !== undefined ? attachments[diff.actual] : undefined);
  const diffImg = attachmentHref(diff.diff !== undefined ? attachments[diff.diff] : undefined);

  const hasPair = expected !== undefined && actual !== undefined;
  const modes: Mode[] = [
    ...(hasPair ? (['slider', 'onion'] as const) : []),
    ...(diffImg ? (['diff'] as const) : []),
  ];
  const [mode, setMode] = useState<Mode>(modes[0] ?? 'diff');
  const [pos, setPos] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const rangeId = useId();

  // Nothing usable (e.g. all sides omitted) — let the generic card list handle it.
  if (modes.length === 0) return null;
  const activeMode = modes.includes(mode) ? mode : (modes[0] as Mode);

  return (
    <div className="rounded-[10px] border border-edge-2 p-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-ink-2">{diff.name}</span>
        <div className="ml-auto flex gap-0.5 rounded-lg border border-edge p-0.5">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-xs capitalize ${
                m === activeMode ? 'bg-brand-soft font-semibold text-brand-text' : 'text-ink-3'
              }`}
            >
              {m === 'onion' ? 'Onion skin' : m}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col items-start gap-2.5">
        {activeMode === 'diff' && diffImg && (
          <img
            src={diffImg}
            alt={`${diff.name} pixel diff`}
            className="max-h-80 max-w-full rounded-md border border-edge"
          />
        )}

        {activeMode !== 'diff' && hasPair && (
          <div className="relative inline-block max-w-full overflow-hidden rounded-md border border-edge">
            <img
              src={expected}
              alt={`${diff.name} expected`}
              className="block max-h-80 max-w-full"
            />
            <img
              src={actual}
              alt={`${diff.name} actual`}
              className="absolute inset-0 h-full w-full"
              style={
                activeMode === 'slider'
                  ? { clipPath: `inset(0 ${100 - pos}% 0 0)` }
                  : { opacity: opacity / 100 }
              }
            />
            {activeMode === 'slider' && (
              <div
                className="pointer-events-none absolute inset-y-0 w-[2px] bg-brand"
                style={{ left: `${pos}%` }}
              />
            )}
            <span className="absolute left-2 top-2 rounded bg-code-bg/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              Actual
            </span>
            <span className="absolute right-2 top-2 rounded bg-code-bg/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              Expected
            </span>
          </div>
        )}

        {activeMode !== 'diff' && hasPair && (
          <label
            htmlFor={rangeId}
            className="flex w-full max-w-md items-center gap-2 text-xs text-ink-3"
          >
            <span className="w-20">{activeMode === 'slider' ? 'Wipe' : 'Actual opacity'}</span>
            <input
              id={rangeId}
              type="range"
              min={0}
              max={100}
              value={activeMode === 'slider' ? pos : opacity}
              onChange={(e) =>
                activeMode === 'slider'
                  ? setPos(Number(e.target.value))
                  : setOpacity(Number(e.target.value))
              }
              className="grow accent-(--brand)"
            />
          </label>
        )}
      </div>
    </div>
  );
}
