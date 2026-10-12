import type { Page, TestType } from '@playwright/test';

/**
 * Optional test-side helpers. Usage:
 *
 *   import { test as base } from '@playwright/test';
 *   import { withBeaconConsole } from 'beacon-reporter/fixtures';
 *   export const test = withBeaconConsole(base);
 *
 * Captures the page's browser console and page errors into a
 * `browser-console` text attachment, which the report renders inline.
 */
type KV = { [key: string]: unknown };

export function withBeaconConsole<TArgs extends { page: Page } & KV, TWorker extends KV>(
  base: TestType<TArgs, TWorker>,
): TestType<TArgs, TWorker> {
  return base.extend({
    page: async (
      { page }: { page: Page },
      use: (page: Page) => Promise<void>,
      testInfo: {
        attach: (name: string, options: { body: string; contentType: string }) => Promise<void>;
      },
    ) => {
      const lines: string[] = [];
      page.on('console', (message) => {
        lines.push(`[${message.type()}] ${message.text()}`);
      });
      page.on('pageerror', (error) => {
        lines.push(`[pageerror] ${error.message}`);
      });
      await use(page);
      if (lines.length > 0) {
        await testInfo.attach('browser-console', {
          body: lines.join('\n'),
          contentType: 'text/plain',
        });
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: Playwright's extend() typing needs the loose cast
  } as any) as TestType<TArgs, TWorker>;
}
