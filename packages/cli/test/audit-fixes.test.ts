import { describe, expect, it } from 'vitest';
import { gate } from '../src/gate';
import { toSlackMrkdwn } from '../src/notify';
import { type QuarantineCandidate, toGrepInvert } from '../src/quarantine';
import { jsonForScript } from '../src/script-json';

describe('audit fixes', () => {
  it('escapes script terminators in exported JSON', () => {
    expect(jsonForScript('</script>')).toBe('"\\u003c/script>"');
  });

  it('anchors and dedupes quarantine titles', () => {
    const row = (title: string): QuarantineCandidate => ({
      caseId: title,
      title,
      projectName: 'chromium',
      failures: 1,
      runs: 3,
    });
    expect(toGrepInvert([row('times out'), row('times out'), row('a+b')])).toBe(
      '^(?:times out|a\\+b)$',
    );
  });

  it('turns summarize markdown into Slack mrkdwn and keeps the report link', () => {
    const text = toSlackMrkdwn(
      '# Beacon\n\n**bold**\n\n| a | b |\n| --- | --- |\n',
      'https://ci/r',
    );
    expect(text).toContain('*Beacon*');
    expect(text).toContain('*bold*');
    expect(text).not.toContain('**');
    expect(text).not.toContain('| --- |');
    expect(text.endsWith('<https://ci/r|Open the report>')).toBe(true);
  });

  it('says when a report directory is missing', async () => {
    await expect(gate('/tmp/beacon-missing-report-dir', {})).rejects.toThrow(/No report found at /);
  });
});
