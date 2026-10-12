import type { ReactNode } from 'react';

/**
 * Minimal ANSI SGR renderer for Playwright's code frames and error output,
 * tuned for the dark code surface. Unknown sequences are dropped.
 */

const FG: Record<number, string> = {
  30: '#8894a6',
  31: '#f87171',
  32: '#86efac',
  33: '#fbbf24',
  34: '#93c5fd',
  35: '#c4b5fd',
  36: '#67e8f9',
  37: '#e8edf4',
  90: '#7286a0',
  91: '#f87171',
  92: '#86efac',
  93: '#fde047',
  94: '#93c5fd',
  95: '#c4b5fd',
  96: '#67e8f9',
  97: '#f8fafc',
};

interface Style {
  color?: string;
  bold?: boolean;
  dim?: boolean;
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes are control chars by definition
const SGR = /\u001b\[([0-9;]*)m/g;

export function stripAnsi(text: string): string {
  return text.replace(SGR, '');
}

export function ansiToNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let style: Style = {};
  let last = 0;
  let key = 0;

  const push = (chunk: string) => {
    if (!chunk) return;
    if (!style.color && !style.bold && !style.dim) {
      nodes.push(chunk);
      return;
    }
    nodes.push(
      <span
        key={key++}
        style={{
          color: style.color,
          fontWeight: style.bold ? 600 : undefined,
          opacity: style.dim ? 0.65 : undefined,
        }}
      >
        {chunk}
      </span>,
    );
  };

  for (const match of text.matchAll(SGR)) {
    push(text.slice(last, match.index));
    last = (match.index ?? 0) + match[0].length;
    for (const part of (match[1] ?? '').split(';')) {
      const code = Number(part || '0');
      if (code === 0) style = {};
      else if (code === 1) style = { ...style, bold: true };
      else if (code === 2) style = { ...style, dim: true };
      else if (code === 22) style = { ...style, bold: false, dim: false };
      else if (code === 39) style = { ...style, color: undefined };
      else if (FG[code]) style = { ...style, color: FG[code] };
    }
  }
  push(text.slice(last));
  return nodes;
}

export function AnsiText({ text }: { text: string }) {
  return <>{ansiToNodes(text)}</>;
}
