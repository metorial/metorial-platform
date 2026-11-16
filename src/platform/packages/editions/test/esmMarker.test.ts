import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEdition } from '../src/tooling/build';

describe('modules without exports in a commonjs package', () => {
  it('can await their dynamically imported top-level await dependencies', async () => {
    let directory = mkdtempSync(join(tmpdir(), 'editions-esm-marker-'));

    writeFileSync(join(directory, 'package.json'), JSON.stringify({ type: 'commonjs' }));
    writeFileSync(join(directory, 'c.ts'), 'export let value = await Promise.resolve(42);\n');
    writeFileSync(
      join(directory, 'b.ts'),
      "import { value } from './c';\nconsole.log(`value:${value}`);\n"
    );
    writeFileSync(
      join(directory, 'a.ts'),
      "async function main() {\n  await import('./b');\n}\nmain();\n"
    );

    let [output] = await buildEdition({
      entry: join(directory, 'a.ts'),
      edition: 'on-prem',
      outdir: join(directory, 'out'),
      sourcemap: 'none'
    });

    let result = spawnSync('bun', [output!], { encoding: 'utf8' });

    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('value:42');
  });
});
