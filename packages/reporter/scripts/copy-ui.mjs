// Embeds the prebuilt report SPA into the reporter package (dist/ui), so the
// published npm package is self-contained. Runs after tsup in the build script;
// turbo orders @beacon-report/ui's build first via the workspace devDependency.
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../ui/dist');
const dest = path.resolve(here, '../dist/ui');

await rm(dest, { recursive: true, force: true });
await cp(src, dest, { recursive: true });
console.log(`[beacon] embedded UI: ${path.relative(process.cwd(), dest)}`);
