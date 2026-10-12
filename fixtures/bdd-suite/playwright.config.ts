import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
});

export default defineConfig({
  testDir,
  // Steps share module-level state, so keep scenarios sequential.
  workers: 1,
  fullyParallel: false,
  reporter: [
    ['list'],
    [
      'beacon-reporter',
      {
        outputFolder: 'beacon-report',
        title: 'BDD demo (playwright-bdd)',
        history: false,
        dashboard: { cards: ['outcomes', 'suites', 'tags', 'files'] },
      },
    ],
  ],
});
