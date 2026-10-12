import type { TestDetail } from '@beacon-report/shared';

/**
 * Failure categories: Allure's categories.json concept merged with Extent's
 * exception view — regex rules over error message/stack classify each failing
 * test. User rules run first (order matters); built-ins catch the rest.
 */

export interface CategoryRule {
  name: string;
  /** Matched against every error message of the failing attempts. */
  messageRegex?: string;
  /** Matched against error stacks. */
  stackRegex?: string;
}

const BUILT_IN: Array<{ name: string; test: (message: string, stack: string) => boolean }> = [
  {
    name: 'Visual diff',
    test: (m) => /toHaveScreenshot|screenshot comparison|snapshot.*(differ|mismatch)/i.test(m),
  },
  // Expect failures mention "Timeout:" when a locator assertion waits out.
  // Those are assertions, not test timeouts, and they also contain "locator".
  { name: 'Assertion', test: (m) => /expect\(|expected.*received|assert/i.test(m) },
  { name: 'Timeout', test: (m) => /timed? ?out|timeout of|exceeded.*timeout/i.test(m) },
  {
    name: 'Selector not found',
    test: (m) => /locator|selector|strict mode violation|element is not/i.test(m),
  },
];

const FALLBACK = 'Other failures';

function compile(rules: CategoryRule[]) {
  return rules.flatMap((rule) => {
    try {
      return [
        {
          name: rule.name,
          message: rule.messageRegex ? new RegExp(rule.messageRegex, 'i') : undefined,
          stack: rule.stackRegex ? new RegExp(rule.stackRegex, 'i') : undefined,
        },
      ];
    } catch {
      console.warn(`[beacon] Invalid regex in category "${rule.name}" — rule ignored`);
      return [];
    }
  });
}

/** Mutates failing details with a `category`; returns nothing (rollups read details). */
export function categorize(details: TestDetail[], rules: CategoryRule[] = []): void {
  const compiled = compile(rules);
  for (const detail of details) {
    if (detail.outcome !== 'unexpected' && detail.outcome !== 'flaky') continue;
    const errors = detail.results.flatMap((r) => r.errors);
    if (errors.length === 0) continue;
    const message = errors.map((e) => e.message).join('\n');
    const stack = errors.map((e) => e.stack ?? '').join('\n');

    const user = compiled.find(
      (rule) => (rule.message?.test(message) ?? false) || (rule.stack?.test(stack) ?? false),
    );
    detail.category =
      user?.name ?? BUILT_IN.find((rule) => rule.test(message, stack))?.name ?? FALLBACK;
  }
}
