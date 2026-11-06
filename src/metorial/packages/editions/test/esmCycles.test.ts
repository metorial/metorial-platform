import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEdition } from '../src/tooling/build';
import { makeEsmCyclesSafe } from '../src/tooling/esmCycles';

describe('async import cycles in a bundle', () => {
  it('finish evaluating instead of awaiting themselves', async () => {
    let directory = mkdtempSync(join(tmpdir(), 'editions-esm-cycles-'));

    writeFileSync(join(directory, 'ready.ts'), 'export let ready = await Promise.resolve(1);\n');
    writeFileSync(
      join(directory, 'service.ts'),
      "import { ready } from './ready';\nimport { queue } from './queue';\nexport let service = { ready, queue: () => queue };\n"
    );
    writeFileSync(
      join(directory, 'queue.ts'),
      "import { service } from './service';\nexport let queue = { run: () => service };\n"
    );
    writeFileSync(
      join(directory, 'a.ts'),
      "let { service } = await import('./service');\nconsole.log(`done:${service.ready}:${typeof service.queue().run}`);\n"
    );

    let [output] = await buildEdition({
      entry: join(directory, 'a.ts'),
      edition: 'on-prem',
      outdir: join(directory, 'out'),
      sourcemap: 'none'
    });

    let result = spawnSync('bun', [output!], { encoding: 'utf8', timeout: 20_000 });

    expect(result.stdout).toContain('done:1:function');
    expect(result.status).toBe(0);
  });

  it('fails the build when the esbuild runtime helper is unrecognized', () => {
    expect(() => makeEsmCyclesSafe('var __esm = () => 1;', 'out.mjs')).toThrow(/cycle-safe/);
    expect(makeEsmCyclesSafe('console.log(1)', 'out.mjs')).toBe('console.log(1)');
  });
});
