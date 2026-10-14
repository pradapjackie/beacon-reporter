import { useManifest } from '../lib/hooks';

/** Playwright config snapshot captured at generate time (JSON-safe excerpt). */
export function ConfigPage() {
  const manifest = useManifest();
  const meta = manifest.data?.manifest.meta;
  const snapshot = meta?.configSnapshot as
    | (Record<string, unknown> & {
        projects?: Array<Record<string, unknown>>;
        reporters?: string[];
      })
    | undefined;

  if (manifest.isPending) {
    return <div className="py-16 text-center text-sm text-ink-3">Loading…</div>;
  }
  if (!snapshot) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] border border-edge bg-card px-8 py-14 text-center">
        <div className="text-sm font-semibold">No config snapshot</div>
        <p className="mt-2 text-[13px] text-ink-3">
          This report was written by an older Beacon version — regenerate it to capture the
          Playwright config.
        </p>
      </div>
    );
  }

  const { projects, reporters, ...flat } = snapshot;
  const rows = Object.entries(flat).filter(([, v]) => v !== undefined && v !== null);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-lg font-semibold">Run configuration</h1>

      <div className="rounded-[14px] border border-edge bg-card p-5">
        <div className="text-sm font-semibold">Playwright config</div>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-[13px]">
          {meta?.playwrightVersion && (
            <>
              <span className="text-ink-3">playwright</span>
              <span className="font-mono">{meta.playwrightVersion}</span>
            </>
          )}
          {rows.map(([key, value]) => (
            <ConfigRow key={key} name={key} value={value} />
          ))}
          {reporters && reporters.length > 0 && (
            <>
              <span className="text-ink-3">reporters</span>
              <span className="font-mono">{reporters.join(', ')}</span>
            </>
          )}
        </div>
      </div>

      {projects && projects.length > 0 && (
        <div
          // biome-ignore lint/a11y/noNoninteractiveTabindex: axe requires scrollable regions be keyboard-reachable
          tabIndex={0}
          className="overflow-x-auto rounded-[14px] border border-edge bg-card"
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-edge-2 text-left text-[11px] uppercase tracking-wide text-ink-3">
                <th className="px-5 py-3 font-semibold">Project</th>
                <th className="px-3 py-3 font-semibold">Test dir</th>
                <th className="px-3 py-3 text-right font-semibold">Timeout</th>
                <th className="px-5 py-3 text-right font-semibold">Retries</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project, i) => (
                <tr
                  key={String(project.name ?? i)}
                  className="border-b border-edge-2 last:border-0"
                >
                  <td className="px-5 py-2.5 font-medium">{String(project.name || 'default')}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-ink-3">
                    {String(project.testDir ?? '')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px]">
                    {typeof project.timeout === 'number' ? `${project.timeout / 1000}s` : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono text-[12px]">
                    {String(project.retries ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfigRow({ name, value }: { name: string; value: unknown }) {
  const text = Array.isArray(value)
    ? value.map(String).join(', ')
    : typeof value === 'boolean'
      ? String(value)
      : String(value);
  return (
    <>
      <span className="text-ink-3">{name}</span>
      <span className="font-mono">{text}</span>
    </>
  );
}
