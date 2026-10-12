import { useState } from 'react';

/**
 * Copy-to-clipboard chip (rerun commands, error text). Clipboard writes can be
 * blocked (sandboxed hosts) — the chip then shows the value for manual copy.
 */
export function CopyChip({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('manual');
    }
  };
  return (
    <span className="inline-flex max-w-full items-center">
      <button
        type="button"
        onClick={copy}
        title={value}
        className={`truncate rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
          state === 'copied'
            ? 'border-passed bg-passed-tint text-passed-text'
            : 'border-edge text-ink-3 hover:border-brand hover:text-brand-text'
        }`}
      >
        {state === 'copied' ? 'Copied ✓' : label}
      </button>
      {state === 'manual' && (
        <input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          className="ml-1.5 w-64 rounded border border-edge bg-card px-1.5 py-0.5 font-mono text-[10px] text-ink-2"
        />
      )}
    </span>
  );
}
