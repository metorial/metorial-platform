import { beforeEach, describe, expect, it, vi } from 'vitest';

let db = {
  sandboxMachineImageRegion: { findFirst: vi.fn() },
  sandboxMachineImageVersionRegion: { findFirst: vi.fn() },
  sandboxSpecRegion: { findFirst: vi.fn() }
};

vi.mock('@metorial/cache', () => ({
  createLocallyCachedFunction: (opts: any) => (i: any) => opts.provider(i)
}));
vi.mock('@metorial/db', () => ({ db }));

let { resolveSandboxImageRef, resolveSandboxSpecId } = await import('../src/lib/publicRefs');

describe('public refs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps genesis image and version ids to public ids', async () => {
    db.sandboxMachineImageRegion.findFirst.mockResolvedValue({ image: { id: 'sbi_1' } });
    db.sandboxMachineImageVersionRegion.findFirst.mockResolvedValue({
      version: { id: 'sbiv_1' }
    });

    let result = await resolveSandboxImageRef({
      regionOid: 1n,
      genesisImageId: 'img_g',
      genesisVersionId: 'ver_g'
    });

    expect(result).toEqual({ imageId: 'sbi_1', versionId: 'sbiv_1' });
    expect(db.sandboxMachineImageRegion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { regionOid: 1n, genesisId: 'img_g' } })
    );
  });

  it('returns null for unknown ids instead of leaking the genesis id', async () => {
    db.sandboxMachineImageRegion.findFirst.mockResolvedValue(null);
    db.sandboxSpecRegion.findFirst.mockResolvedValue(null);

    expect(await resolveSandboxImageRef({ regionOid: 1n, genesisImageId: 'x' })).toEqual({
      imageId: null,
      versionId: null
    });
    expect(await resolveSandboxSpecId({ regionOid: 1n, genesisSpecId: 'x' })).toBeNull();
  });
});
