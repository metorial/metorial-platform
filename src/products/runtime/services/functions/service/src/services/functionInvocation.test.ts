import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  invokeFunction: vi.fn()
}));

vi.mock('../db', () => ({
  db: { function: { findFirst: mocks.findFirst, findUnique: mocks.findUnique } }
}));
vi.mock('../id', () => ({ ID: { generateId: vi.fn(async () => 'finv_1') } }));
vi.mock('../lib/ensureRehomed', () => ({ ensureRehomed: async (version: any) => version }));
vi.mock('../lib/presentInvokeResponse', () => ({
  presentInvokeResponse: (d: any) => ({ functionVersionId: d.functionVersionId })
}));
vi.mock('../providers', () => ({
  getProvider: () => ({ invokeFunction: mocks.invokeFunction })
}));
vi.mock('./enclave', () => ({ enclaveService: {} }));

let version = (oid: bigint) => ({
  oid,
  id: `fver_${oid}`,
  providerData: {},
  runtime: { providerOid: 1n }
});

let func = (currentVersionOid: bigint) => ({
  oid: 10n,
  id: 'func_1',
  currentVersionOid,
  currentVersion: version(currentVersionOid)
});

let loadService = async () => {
  vi.resetModules();
  return (await import('./functionInvocation')).functionInvocationService;
};

let invoke = (service: Awaited<ReturnType<typeof loadService>>, functionId = 'func_1') =>
  service.invokeFunction({ tenantId: 'ten_1', functionId, payload: {} });

describe('functionInvocationService', () => {
  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.findUnique.mockReset();
    mocks.invokeFunction.mockReset();
    mocks.invokeFunction.mockResolvedValue({});
  });

  it('serves a cached function while its current version is unchanged', async () => {
    let service = await loadService();
    mocks.findFirst.mockResolvedValue(func(1n));
    mocks.findUnique.mockResolvedValue({ currentVersionOid: 1n });

    await invoke(service);
    expect(await invoke(service)).toEqual({ functionVersionId: 'fver_1' });

    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { oid: 10n },
      select: { currentVersionOid: true }
    });
  });

  it('runs the newly deployed version right after a deploy', async () => {
    let service = await loadService();
    mocks.findFirst.mockResolvedValueOnce(func(1n)).mockResolvedValueOnce(func(2n));
    mocks.findUnique.mockResolvedValue({ currentVersionOid: 2n });

    expect(await invoke(service)).toEqual({ functionVersionId: 'fver_1' });
    expect(await invoke(service)).toEqual({ functionVersionId: 'fver_2' });

    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
  });

  it('finds a function created right after a lookup missed it', async () => {
    let service = await loadService();
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(func(1n));

    await expect(invoke(service)).rejects.toThrow();
    expect(await invoke(service)).toEqual({ functionVersionId: 'fver_1' });

    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
  });
});
