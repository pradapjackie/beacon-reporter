// Embeds the built CLI into the published reporter package (dist/cli), so one
// `npm i beacon-reporter` ships the `beacon` bin too. Runs after tsup
// in the build script; turbo builds the reporter (which cleans its dist) first.
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../dist');
const dest = path.resolve(here, '../../reporter/dist/cli');

await rm(dest, { recursive: true, force: true });
await cp(src, dest, { recursive: true });
console.log(`[beacon] embedded CLI: ${path.relative(process.cwd(), dest)}`);
