#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import path from 'node:path';
import { isE2EEnvironment } from './env';

if (!isE2EEnvironment()) {
  console.error(
    'metorial-e2e only runs inside `bun run control test:e2e` (CONTROL_E2E=1 is not set).'
  );
  process.exit(1);
}

let vitest = path.join(
  path.dirname(Bun.resolveSync('vitest/package.json', import.meta.dir)),
  'vitest.mjs'
);
let packageConfig = path.join(process.cwd(), 'vitest.e2e.config.ts');
let config = existsSync(packageConfig)
  ? packageConfig
  : path.join(import.meta.dir, '..', 'vitest.e2e.config.ts');

// Modules use Bun APIs at runtime, so Vitest (and its forked workers) run on Bun, not Node.
let child = Bun.spawn(
  [
    process.execPath,
    vitest,
    'run',
    '--config',
    config,
    '--root',
    process.cwd(),
    ...process.argv.slice(2)
  ],
  { stdio: ['inherit', 'inherit', 'inherit'], env: process.env }
);

process.exit(await child.exited);
