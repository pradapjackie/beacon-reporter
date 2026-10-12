import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  target: 'node18',
  // Never bundle the reporter: its writer locates the embedded UI relative to
  // its own dist, which bundling into the CLI would break.
  external: ['beacon-reporter', '@playwright/test'],
});
