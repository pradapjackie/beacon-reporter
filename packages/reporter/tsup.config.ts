import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  entry: ['src/index.ts', 'src/fixture-recorder.ts', 'src/replay.ts', 'src/fixtures.ts'],
  // Dual format: Playwright loads reporters via require() in CJS projects.
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  // import.meta.url must work in the CJS build too (writer locates dist/ui by it).
  shims: true,
  define: {
    __BEACON_VERSION__: JSON.stringify(pkg.version),
  },
  // Bundle the private workspace schema package instead of depending on it at runtime.
  noExternal: ['@beacon-report/shared'],
  external: ['@playwright/test'],
});
