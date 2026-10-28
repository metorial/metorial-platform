import { describe, expect, it } from 'bun:test';
import JSZip from 'jszip';
import { getSlatePackageChecksum, readZipEntries } from './archive';
import { getPrebuiltEntrypointProblem } from './entrypoint';
import { parseSlateFullIdentifier } from './manifest';

let createZipArchive = async (files: Record<string, string>) => {
  let zip = new JSZip();
  for (let [path, content] of Object.entries(files)) zip.file(path, content);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
};

let files = {
  'package.json': JSON.stringify({
    name: '@npm/weather',
    version: '1.0.0',
    main: './dist/index.js'
  }),
  'slate.json': JSON.stringify({ name: '@demo/weather' }),
  'dist/index.js': 'export {};'
};

let checksumOf = async (archiveFiles: Record<string, string>) =>
  getSlatePackageChecksum(await readZipEntries(await createZipArchive(archiveFiles)));

describe('slate package archives', () => {
  it('checksums file contents independently of archive order', async () => {
    let checksum = await checksumOf(files);

    expect(checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await checksumOf(Object.fromEntries(Object.entries(files).reverse()))).toBe(
      checksum
    );
    expect(await checksumOf({ ...files, 'dist/index.js': 'export default 1;' })).not.toBe(
      checksum
    );

    let { 'dist/index.js': entry, ...rest } = files;
    expect(await checksumOf({ ...rest, 'dist/main.js': entry })).not.toBe(checksum);
  });

  it('rejects archives that are not zips or contain parent-directory paths', async () => {
    await expect(readZipEntries(Buffer.from('not a zip'))).rejects.toThrow();
    await expect(readZipEntries(Buffer.alloc(0))).rejects.toThrow();
    await expect(
      readZipEntries(await createZipArchive({ ...files, 'dist/../../escape.js': 'x' }))
    ).rejects.toThrow();
  });

  it('accepts npm-style prefixes unless canonical paths are required', async () => {
    let prefixed = await createZipArchive(
      Object.fromEntries(
        Object.entries(files).map(([path, content]) => [`package/${path}`, content])
      )
    );

    expect((await readZipEntries(prefixed)).map(entry => entry.path).sort()).toEqual(
      Object.keys(files).sort()
    );
    await expect(readZipEntries(prefixed, { requireCanonicalPaths: true })).rejects.toThrow();
  });
});

describe('prebuilt entrypoint check', () => {
  let problemFor = async (archiveFiles: Record<string, string>) =>
    getPrebuiltEntrypointProblem(await readZipEntries(await createZipArchive(archiveFiles)));

  it('accepts a package whose main resolves into dist/', async () => {
    expect(await problemFor(files)).toBeNull();
  });

  it('rejects any source entrypoint the hub would build from instead', async () => {
    for (let source of ['src/index.ts', 'src/index.js', 'index.ts', 'index.js']) {
      expect(await problemFor({ ...files, [source]: 'export {};' })).toContain(source);
    }
  });

  it('rejects a main that does not resolve to a dist/ file', async () => {
    expect(
      await problemFor({
        'package.json': JSON.stringify({ name: '@npm/weather', main: 'dist/missing.js' }),
        'slate.json': files['slate.json'],
        'dist/other.js': 'export {};'
      })
    ).toContain('dist/');
  });
});

describe('slate identifiers', () => {
  it('parses scoped names and rejects unsafe segments', () => {
    expect(parseSlateFullIdentifier('@__test__/no-auth')).toEqual({
      fullIdentifier: '__test__/no-auth',
      scopeIdentifier: '__test__',
      slateIdentifier: 'no-auth'
    });
    expect(parseSlateFullIdentifier('metorial/slack')?.slateIdentifier).toBe('slack');

    for (let name of ['@acme/..', '@acme/.', '@acme/a/b', '@acme', '@ac me/x', '@acme/x%2f']) {
      expect(parseSlateFullIdentifier(name)).toBeNull();
    }
  });
});
