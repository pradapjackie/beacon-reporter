import { TEST_OUTCOMES } from '@beacon-report/shared';
import { Link } from '@tanstack/react-router';
import { MasonryCell } from '../components/masonry';
import { OUTCOME_DOT, OUTCOME_LABEL } from '../lib/format';
import { useManifest } from '../lib/hooks';

/**
 * Requirements traceability matrix: every `requirement: <id>` annotation with
 * the tests that cover it and their outcomes — computed at generate time.
 */
export function RequirementsPage() {
  const manifest = useManifest();
  const matrix = manifest.data?.manifest.aggregates.requirementsMatrix ?? [];
  const links = manifest.data?.manifest.ui?.links ?? {};

  if (manifest.isPending) {
    return <div className="py-16 text-center text-sm text-ink-3">Loading…</div>;
  }
  if (matrix.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] border border-edge bg-card px-8 py-14 text-center">
        <div className="text-sm font-semibold">No requirements traced</div>
        <p className="mt-2 text-[13px] text-ink-2">
          Annotate tests with{' '}
          <code className="font-mono text-xs">
            {'testInfo.annotations.push({ type: "requirement", description: "REQ-123" })'}
          </code>{' '}
          and each requirement appears here with the tests that cover it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-lg font-bold">Requirements</h1>
        <p className="text-xs text-ink-3">
          {matrix.length} requirements traced · a requirement passes when every covering test passes
        </p>
      </div>

      <div className="grid auto-rows-[8px] grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
        {matrix.map((requirement) => {
          const failing = requirement.tests.filter(
            (t) => TEST_OUTCOMES[t.outcome] === 'unexpected',
          ).length;
          const template = links.requirement;
          return (
            <MasonryCell key={requirement.id}>
              <div className="rounded-[14px] border border-edge bg-card p-5">
                <div className="flex items-center gap-2.5">
                  {template ? (
                    <a
                      href={template.replace('{}', encodeURIComponent(requirement.id))}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm font-semibold text-brand-text hover:underline"
                    >
                      {requirement.id}
                    </a>
                  ) : (
                    <span className="font-mono text-sm font-semibold">{requirement.id}</span>
                  )}
                  <span
                    className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      failing > 0
                        ? 'bg-failed-tint text-failed-text'
                        : 'bg-passed-tint text-passed-text'
                    }`}
                  >
                    {failing > 0 ? `${failing} failing` : 'covered & passing'}
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-1">
                  {requirement.tests.map((test) => {
                    const outcome = TEST_OUTCOMES[test.outcome] ?? 'expected';
                    return (
                      <Link
                        key={test.caseId}
                        to="/tests/$caseId"
                        params={{ caseId: test.caseId }}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-card-2"
                        title={OUTCOME_LABEL[outcome]}
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${OUTCOME_DOT[outcome]}`} />
                        <span className="truncate">{test.title}</span>
                        <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-4">
                          {test.projectName || 'default'}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </MasonryCell>
          );
        })}
      </div>

      <p className="text-[12px] text-ink-4">
        Add <code className="font-mono">links.requirement</code> to the reporter config (e.g.{' '}
        <code className="font-mono">{'"https://jira.example.com/browse/{}"'}</code>) to make
        requirement ids link to your tracker.
      </p>
    </div>
  );
}
