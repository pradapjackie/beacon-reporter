import { type ReporterDescription, defineConfig } from '@playwright/test';

const reporters: ReporterDescription[] = [
  ['list'],
  [
    'beacon-reporter',
    {
      outputFolder: 'beacon-report',
      title: 'Beacon demo suite',
      dashboard: {
        cards: [
          'outcomes',
          'health',
          'trend',
          'slowest',
          'failing',
          'projects',
          'tags',
          'categories',
          'incidents',
          'severity',
          'owners',
          'slowed',
          'waste',
          'budgets',
          'metrics',
          'heatmap',
          'durations',
          'treemap',
          'files',
          'suites',
          'steps',
          'a11y',
          'percentiles',
          'coverage',
          'requirements',
          'environment',
        ],
        slowest: 5,
      },
      branding: {
        logo: 'beacon-logo.svg',
      },
      coverage: 'coverage/coverage-summary.json',
      environment: {
        app: 'demo-shop 2.4.1',
        env: 'staging',
      },
      links: {
        issue: 'https://github.com/your-org/your-repo/issues/{}',
        requirement: 'https://jira.example.com/browse/{}',
      },
      categories: [{ name: 'Payment gateway', messageRegex: 'payment|gateway|card' }],
      editorLinks: true,
      scrub: [{ pattern: 'secret-\\d+', replacement: '[redacted]' }],
      // BEACON_WATCH=1 (or watch: true) turns on live interim writes.
      // Example plugin: a custom dashboard card computed from the final tests.
      plugins: [
        {
          name: 'hygiene',
          card: (details: Array<{ tags: string[]; annotations: Array<{ type: string }> }>) => ({
            id: 'hygiene',
            title: 'Test hygiene',
            subtitle: 'from the demo "hygiene" plugin',
            rows: [
              { label: 'Total tests', value: String(details.length) },
              {
                label: 'Untagged',
                value: String(details.filter((d) => d.tags.length === 0).length),
              },
              {
                label: 'With an owner',
                value: String(
                  details.filter((d) => d.annotations.some((a) => a.type === 'owner')).length,
                ),
              },
            ],
          }),
        },
      ],
    },
  ],
];

// RECORD_FIXTURES=1 also records the raw Reporter API event stream into the
// reporter package's replay-test fixtures (root script: pnpm record-fixtures).
if (process.env.RECORD_FIXTURES) {
  reporters.push([
    'beacon-reporter/fixture-recorder',
    { outputFile: '../../packages/reporter/test/fixtures/demo-suite.json' },
  ]);
}

export default defineConfig({
  testDir: './tests',
  retries: 1,
  // Two projects exercise the multi-project dimension of the report.
  // No `use` block: these fixture specs are browser-free on purpose, so the
  // demo runs without downloading browsers. Browser specs arrive in Phase 1.
  projects: [
    { name: 'alpha', testMatch: /demo\.spec\.ts/ },
    { name: 'beta', testMatch: /demo\.spec\.ts/ },
    // Real browser run so the report carries genuine video + trace files.
    {
      name: 'chromium',
      testMatch: /browser\.spec\.ts/,
      use: { video: 'on', trace: 'on' },
    },
  ],
  reporter: reporters,
});
