import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { sanitizeLambdaBundle, stripSourcemapRegisterImports } from './sanitizeLambdaBundle';

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe('stripSourcemapRegisterImports', () => {
  it('removes sourcemap-register imports from bundle entrypoints', () => {
    expect(
      stripSourcemapRegisterImports("import './sourcemap-register.cjs';\nexport let handler = 1;")
    ).toBe('export let handler = 1;');
  });
});

describe('sanitizeLambdaBundle', () => {
  it('keeps source maps while removing runtime sourcemap registration', async () => {
    let dir = await mkdtemp(join(tmpdir(), 'fbay-sanitize-'));
    tempDirs.push(dir);

    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'fn', type: 'module' }),
      'utf-8'
    );
    await writeFile(
      join(dir, 'index.js'),
      "import './sourcemap-register.cjs';\nexports.handler = () => {};",
      'utf-8'
    );
    await writeFile(join(dir, 'index.js.map'), '{"version":3}', 'utf-8');
    await writeFile(join(dir, 'sourcemap-register.cjs'), '__dirname', 'utf-8');

    await sanitizeLambdaBundle(dir);

    expect(JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8')).type).toBeUndefined();
    expect(await readFile(join(dir, 'index.js'), 'utf-8')).toBe('exports.handler = () => {};');
    expect(await readFile(join(dir, 'index.js.map'), 'utf-8')).toBe('{"version":3}');

    await expect(readFile(join(dir, 'sourcemap-register.cjs'), 'utf-8')).rejects.toThrow();
  });
});
