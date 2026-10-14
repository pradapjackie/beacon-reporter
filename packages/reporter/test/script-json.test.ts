import { describe, expect, it } from 'vitest';
import { jsonForScript } from '../src/script-json';

describe('jsonForScript', () => {
  it('keeps </script> and comment openers from closing an HTML script', () => {
    const json = jsonForScript({
      title: '</script><script>document.title="xss"</script>',
      note: '<!--',
      sep: 'a\u2028b\u2029c',
    });
    expect(json).not.toContain('</');
    expect(json).not.toContain('<!--');
    expect(json).toContain('\\u003c/script>');
    expect(json).toContain('\\u2028');
    expect(json).toContain('\\u2029');
    expect(JSON.parse(json).title).toBe('</script><script>document.title="xss"</script>');
  });
});
