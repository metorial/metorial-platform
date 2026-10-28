import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({
  settings: new Map<string, { contentHashKey: string | null; projectOid: bigint }>()
}));

let mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findTenant: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  getId: (model: string) => ({ oid: BigInt(1), id: `${model}_1` }),
  db: {
    tenant: { findUniqueOrThrow: mocks.findTenant },
    protoGuardTenantSetting: {
      findUnique: async (args: any) => {
        mocks.findUnique(args);
        return state.settings.get(String(args.where.tenantOid)) ?? null;
      },
      findUniqueOrThrow: async (args: any) => {
        let setting = state.settings.get(String(args.where.tenantOid));
        if (!setting) throw new Error('not found');
        return setting;
      },
      upsert: async (args: any) => {
        mocks.upsert(args);
        let key = String(args.where.tenantOid);
        if (!state.settings.has(key)) {
          state.settings.set(key, {
            contentHashKey: args.create.contentHashKey,
            projectOid: args.create.projectOid
          });
        }
      },
      updateMany: async (args: any) => {
        mocks.updateMany(args);
        let setting = state.settings.get(String(args.where.tenantOid));
        if (setting && setting.contentHashKey === null) {
          setting.contentHashKey = args.data.contentHashKey;
        }
      }
    }
  }
}));

let load = async () => (await import('./contentHashKey')).getContentHashKey;

describe('getContentHashKey', () => {
  beforeEach(() => {
    vi.resetModules();
    state.settings.clear();
    for (let mock of Object.values(mocks)) mock.mockReset();
    mocks.findTenant.mockImplementation(async (args: any) => ({
      projectOid: args.where.oid * BigInt(10)
    }));
  });

  it('creates a 32-byte key on first use', async () => {
    let getContentHashKey = await load();
    let key = await getContentHashKey({ tenantOid: BigInt(1) });

    expect(Buffer.from(key, 'base64url')).toHaveLength(32);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantOid: BigInt(1) },
        update: {},
        create: expect.objectContaining({ tenantOid: BigInt(1), projectOid: BigInt(10) })
      })
    );
    expect(state.settings.get('1')!.contentHashKey).toBe(key);
  });

  it('keeps the key stable across calls and processes', async () => {
    let first = await (await load())({ tenantOid: BigInt(1) });
    let cached = await (await load())({ tenantOid: BigInt(1) });

    vi.resetModules();
    let fresh = await (await load())({ tenantOid: BigInt(1) });

    expect(cached).toBe(first);
    expect(fresh).toBe(first);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it('serves repeated calls from the local cache', async () => {
    let getContentHashKey = await load();
    await getContentHashKey({ tenantOid: BigInt(1) });
    await getContentHashKey({ tenantOid: BigInt(1) });

    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
  });

  it('gives every tenant its own key', async () => {
    let getContentHashKey = await load();
    let a = await getContentHashKey({ tenantOid: BigInt(1) });
    let b = await getContentHashKey({ tenantOid: BigInt(2) });

    expect(a).not.toBe(b);
  });

  it('fills in a key for an existing settings row without one', async () => {
    state.settings.set('1', { contentHashKey: null, projectOid: BigInt(10) });
    let key = await (await load())({ tenantOid: BigInt(1) });

    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { tenantOid: BigInt(1), contentHashKey: null },
      data: { contentHashKey: key }
    });
  });

  it('converges on the stored key when another process won the race', async () => {
    state.settings.set('1', { contentHashKey: null, projectOid: BigInt(10) });
    mocks.updateMany.mockImplementationOnce(() => {
      state.settings.get('1')!.contentHashKey = 'winner-key';
    });

    let getContentHashKey = await load();

    expect(await getContentHashKey({ tenantOid: BigInt(1) })).toBe('winner-key');
  });

  it('never replaces an existing key', async () => {
    state.settings.set('1', { contentHashKey: 'existing-key', projectOid: BigInt(10) });

    expect(await (await load())({ tenantOid: BigInt(1) })).toBe('existing-key');
    expect(mocks.findTenant).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
