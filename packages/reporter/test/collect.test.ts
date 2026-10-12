import type { AttachmentRef } from '@beacon-report/shared';
import { describe, expect, it } from 'vitest';
import { detectVisualDiffs } from '../src/collect';

const ref = (name: string): AttachmentRef => ({
  name,
  contentType: 'image/png',
  sha256: 'a'.repeat(64),
  ext: 'png',
  mode: 'stored',
});

describe('detectVisualDiffs', () => {
  it('groups expected/actual/diff triples by snapshot name', () => {
    const refs = [
      ref('hero-expected.png'),
      ref('hero-actual.png'),
      ref('hero-diff.png'),
      ref('greeting'),
    ];
    expect(detectVisualDiffs(refs)).toEqual([{ name: 'hero', expected: 0, actual: 1, diff: 2 }]);
  });

  it('handles partial pairs but ignores lone matches', () => {
    expect(
      detectVisualDiffs([ref('a-expected.png'), ref('a-actual.png'), ref('b-diff.png')]),
    ).toEqual([{ name: 'a', expected: 0, actual: 1 }]);
  });

  it('keeps multiple snapshots separate', () => {
    const refs = [
      ref('header-expected.png'),
      ref('header-actual.png'),
      ref('footer-actual.png'),
      ref('footer-diff.png'),
    ];
    expect(detectVisualDiffs(refs)).toEqual([
      { name: 'header', expected: 0, actual: 1 },
      { name: 'footer', actual: 2, diff: 3 },
    ]);
  });
});
