import { beforeEach, describe, expect, it, vi } from 'vitest';

let { getContentHashes } = vi.hoisted(() => ({ getContentHashes: vi.fn() }));

vi.mock('@metorial/module-file', () => ({
  fileService: { getContentHashes },
  hasValidContentHashes: (file: { contentSha256: string | null }) => !!file.contentSha256
}));

import type { StorageBackedFile } from '../../../serializers/_lib/types';
import { ManifestApplyContext } from './applyContext';

let mib = 1024 * 1024;

let hashes = (seed: string) => ({
  sha256: seed.repeat(64).slice(0, 64),
  gitBlobSha: seed.repeat(40).slice(0, 40),
  crc32: 7,
  size: 3
});

let file = (overrides: Partial<StorageBackedFile> = {}) =>
  ({
    oid: 1n,
    id: 'file_1',
    status: 'active',
    storeId: 'files/1',
    fileSize: 3,
    contentSha256: null,
    contentSha256StoreId: null,
    contentGitBlobSha: null,
    contentCrc32: null,
    ...overrides
  }) as StorageBackedFile;

let createContext = () =>
  new ManifestApplyContext({ inlineHashMaxBytes: 64 * mib, maxFileBytes: 1024 * mib });

describe('ManifestApplyContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getContentHashes.mockResolvedValue(hashes('a'));
  });

  it('resolves paths against the base path without a leading slash', async () => {
    let context = createContext();
    context.setBasePath('/plugins/acme/');
    await context.setFile('/skills/qa/SKILL.md', '# QA');
    context.setBasePath(undefined);
    await context.setFile('.claude-plugin/marketplace.json', '{}');

    let { entries } = await context.collect();

    expect(entries.map(entry => entry.path)).toEqual([
      'plugins/acme/skills/qa/SKILL.md',
      '.claude-plugin/marketplace.json'
    ]);
    expect(Buffer.from((entries[0] as { bytes: Uint8Array }).bytes).toString()).toBe('# QA');
  });

  it('drops invalid paths and reports why', async () => {
    let context = createContext();
    await context.setFile('skills/.git/config', 'x');
    await context.setFile('skills/ok.md', 'x');

    let result = await context.collect();

    expect(result.entries.map(entry => entry.path)).toEqual(['skills/ok.md']);
    expect(result.invalidPaths).toEqual([
      { path: 'skills/.git/config', violation: expect.any(String) }
    ]);
  });

  it('keeps the last write to a path even if an earlier write is still hashing', async () => {
    let release!: () => void;
    getContentHashes.mockReturnValueOnce(
      new Promise(resolve => {
        release = () => resolve(hashes('a'));
      })
    );

    let context = createContext();
    await context.setFileFromStorage('doc.md', file());
    await context.setFile('doc.md', 'generated');
    release();

    let { entries } = await context.collect();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ path: 'doc.md', kind: 'bytes' });
  });

  it('uses stored hashes for stored files and buffered bytes for pending content', async () => {
    getContentHashes
      .mockResolvedValueOnce(hashes('b'))
      .mockResolvedValueOnce({ ...hashes('c'), pendingContent: new Uint8Array([1, 2, 3]) });

    let context = createContext();
    await context.setFileFromStorage('stored.bin', file({ oid: 1n }));
    await context.setFileFromStorage('pending.bin', file({ oid: 2n }));

    let { entries } = await context.collect();

    expect(entries[0]).toMatchObject({
      path: 'stored.bin',
      kind: 'file',
      hashes: hashes('b')
    });
    expect(entries[0]).not.toHaveProperty('hashes.pendingContent');
    expect(entries[1]).toMatchObject({ path: 'pending.bin', kind: 'bytes' });
    expect((entries[1] as { file: StorageBackedFile }).file.oid).toBe(2n);
  });

  it('defers large files without hashes instead of hashing them inline', async () => {
    let context = createContext();
    let large = file({ fileSize: BigInt(65 * mib) });
    let largeHashed = file({ oid: 2n, fileSize: BigInt(65 * mib), contentSha256: 'x'.repeat(64) });

    await context.setFileFromStorage('large.bin', large);
    await context.setFileFromStorage('large-hashed.bin', largeHashed);

    let result = await context.collect();

    expect(result.unhashedFiles).toEqual([{ path: 'large.bin', file: large }]);
    expect(result.entries.map(entry => entry.path)).toEqual(['large-hashed.bin']);
    expect(getContentHashes).toHaveBeenCalledOnce();
  });

  it('reports files over the per-file cap without reading them', async () => {
    let context = createContext();
    let huge = file({ fileSize: BigInt(1025 * mib), contentSha256: 'x'.repeat(64) });

    await context.setFileFromStorage('huge.bin', huge);

    let result = await context.collect();

    expect(result.oversizedFiles).toEqual([{ path: 'huge.bin', file: huge }]);
    expect(result.entries).toEqual([]);
    expect(getContentHashes).not.toHaveBeenCalled();
  });

  it('ignores deletes since the item rows are replaced as a whole', async () => {
    let context = createContext();
    await context.setFile('a.md', 'a');
    await context.deletePath('a.md');

    expect((await context.collect()).entries).toHaveLength(1);
  });
});
