import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEdition } from '../src/tooling/build';

let packageEntry = new URL('../src/index.ts', import.meta.url).pathname;

let createEntry = () => {
  let directory = mkdtempSync(join(tmpdir(), 'editions-dev-build-'));
  let entry = join(directory, 'main.ts');

  writeFileSync(
    entry,
    `import { isBuilt } from '@metorial/editions';
     let code = 'RANDOM_CODE';
     if (!isBuilt() && process.env.NODE_ENV === 'development') {
       code = 'FIXED_DEVELOPMENT_CODE';
       await import('./admin');
     }
     console.log(code);`
  );
  writeFileSync(join(directory, 'admin.ts'), "console.log('DEVELOPMENT_ADMIN_UPSERT');");
  writeFileSync(
    join(directory, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { paths: { '@metorial/editions': [packageEntry] } } })
  );

  return { directory, entry };
};

describe('development shortcuts', () => {
  it('keeps fixed codes and admin provisioning when running source', () => {
    let { entry } = createEntry();
    let result = spawnSync('bun', [entry], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'development' }
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('FIXED_DEVELOPMENT_CODE');
    expect(result.stdout).toContain('DEVELOPMENT_ADMIN_UPSERT');
  });

  it.each(['cloud', 'on-prem'] as const)(
    'removes fixed codes and admin provisioning from %s builds even with development env vars',
    async edition => {
      let { directory, entry } = createEntry();
      let outfile = join(directory, 'dist/index.js');
      await buildEdition({ entry, edition, outfile });

      let bundle = readFileSync(outfile, 'utf8');
      expect(bundle).not.toContain('FIXED_DEVELOPMENT_CODE');
      expect(bundle).not.toContain('DEVELOPMENT_ADMIN_UPSERT');

      let result = spawnSync('bun', [outfile], {
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'development', METORIAL_ENV: 'development' }
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe('RANDOM_CODE');
    }
  );
});
