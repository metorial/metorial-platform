import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findRegistrations: vi.fn(),
  decrypt: vi.fn()
}));

vi.mock('../db', () => ({
  db: { slateWebhookRegistration: { findMany: mocks.findRegistrations } }
}));

vi.mock('../services/secret', () => ({
  secretService: { DANGEROUSLY_decryptSecret: mocks.decrypt }
}));

vi.mock('../services/tenant', () => ({
  globalTenant: { oid: 99n, identifier: '__slates_global__' }
}));

import { triggerDeliveryConfigServiceInternal as service } from './triggerDeliveryConfigServiceInternal';

let clientId = 'client-a';

type Row = {
  id: string;
  oid: bigint;
  type: string;
  status: string;
  owner: 'tenant' | 'global';
  tenantOid: bigint | null;
  slateOid: bigint;
  key: string;
  oauthClientId: string | null;
  secretOid: bigint;
  payload: unknown;
};

let rows: Row[];

let config = (name: string, change: Partial<Row> = {}): Row => {
  let oid = BigInt(rows.length + 1);
  let row: Row = {
    id: `whr_${name}`,
    oid,
    type: 'delivery_config',
    status: 'active',
    owner: 'tenant',
    tenantOid: 1n,
    slateOid: 7n,
    key: 'mail',
    oauthClientId: clientId,
    secretOid: 100n + oid,
    payload: { topic: name },
    ...change
  };
  rows.push(row);
  return row;
};

let globalConfig = (name: string, change: Partial<Row> = {}) =>
  config(name, { owner: 'global', tenantOid: null, ...change });

let tenant = { oid: 1n } as any;

let deliveryGroup = {
  key: 'mail',
  spec: {
    invocation: {
      type: 'webhook',
      registration: {
        mode: 'auto',
        deliveryConfig: { userConfigSchema: {}, fullConfigSchema: {} }
      }
    }
  }
} as any;

let select = (change: Record<string, unknown> = {}) =>
  service.selectDeliveryConfig({
    tenant,
    slate: { oid: 7n },
    triggerGroup: deliveryGroup,
    oauthClientId: clientId,
    ...change
  });

let decryptedSecrets = () => mocks.decrypt.mock.calls.map(([call]) => call.secretOid);

beforeEach(() => {
  vi.resetAllMocks();
  rows = [];

  mocks.findRegistrations.mockImplementation(async ({ where }: any) =>
    rows
      .filter(
        row =>
          row.type === where.type &&
          row.status === where.status &&
          row.slateOid === where.slateOid &&
          row.oauthClientId === where.oauthClientId &&
          row.key === where.triggerGroup.key &&
          where.OR.some(
            (owner: any) =>
              owner.owner === row.owner &&
              (owner.tenantOid === undefined || owner.tenantOid === row.tenantOid)
          )
      )
      .sort((a, b) => Number(a.oid - b.oid))
  );

  // Mirrors the secret service: a payload opens only for the tenant that owns it.
  mocks.decrypt.mockImplementation(async (d: any) => {
    let row = rows.find(row => row.secretOid === d.secretOid)!;
    if ((row.owner === 'global' ? 99n : row.tenantOid) !== d.tenant.oid)
      throw new Error('WTF - Secret tenant mismatch');
    return { payload: row.payload };
  });
});

describe('delivery config selection', () => {
  it.each([
    ['a manual webhook group', { type: 'webhook', registration: { mode: 'manual' } }],
    [
      'an automatic group without a delivery config',
      { type: 'webhook', registration: { mode: 'auto' } }
    ],
    ['a polling group', { type: 'polling', intervalSeconds: 600 }]
  ])('needs no config for %s and makes no query', async (_, invocation) => {
    await expect(
      select({ triggerGroup: { key: 'mail', spec: { invocation } }, oauthClientId: undefined })
    ).resolves.toBeUndefined();
    expect(mocks.findRegistrations).not.toHaveBeenCalled();
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });

  it('queries by the OAuth client ID column and hands out the saved payload as the binding', async () => {
    globalConfig('shared');

    await expect(select()).resolves.toEqual({
      bindingId: 'whr_shared',
      deliveryConfig: { topic: 'shared' }
    });
    expect(mocks.findRegistrations).toHaveBeenCalledWith({
      where: {
        type: 'delivery_config',
        status: 'active',
        slateOid: 7n,
        oauthClientId: clientId,
        triggerGroup: { key: 'mail' },
        OR: [{ owner: 'tenant', tenantOid: 1n }, { owner: 'global' }]
      },
      orderBy: { oid: 'asc' },
      select: { id: true, owner: true, secretOid: true }
    });
    expect(mocks.decrypt).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'slate_webhook_registration_payload',
        tenant: expect.objectContaining({ oid: 99n })
      })
    );
  });

  it('prefers the config of the tenant over the global one and opens only that one', async () => {
    let shared = globalConfig('shared');
    let own = config('own');

    await expect(select()).resolves.toEqual({
      bindingId: 'whr_own',
      deliveryConfig: { topic: 'own' }
    });
    expect(decryptedSecrets()).toEqual([own.secretOid]);
    expect(decryptedSecrets()).not.toContain(shared.secretOid);
  });

  it('falls through to the global config when the tenant config is for another OAuth app', async () => {
    config('own', { oauthClientId: 'client-b' });
    globalConfig('shared');

    await expect(select()).resolves.toMatchObject({ bindingId: 'whr_shared' });
    await expect(select({ oauthClientId: 'client-b' })).resolves.toMatchObject({
      bindingId: 'whr_own'
    });
  });

  it('never chooses or reads the config of another tenant', async () => {
    let foreign = config('foreign', { tenantOid: 2n });

    await expect(select()).rejects.toMatchObject({
      data: { code: 'trigger_delivery_config_missing' }
    });
    expect(decryptedSecrets()).not.toContain(foreign.secretOid);

    globalConfig('shared');
    await expect(select()).resolves.toMatchObject({ bindingId: 'whr_shared' });
    expect(decryptedSecrets()).not.toContain(foreign.secretOid);
  });

  it.each([
    ['is still awaiting setup', { status: 'awaiting_setup' }],
    ['was deleted', { status: 'deleted' }],
    ['belongs to another integration', { slateOid: 8n }],
    ['belongs to another trigger group', { key: 'calendar' }],
    ['is for another OAuth app', { oauthClientId: 'client-b' }],
    ['is a manual webhook', { type: 'manual' }],
    ['is an automated registration', { type: 'automated' }]
  ])('ignores a registration that %s', async (_, change) => {
    config('other', change);

    await expect(select()).rejects.toMatchObject({
      data: { code: 'trigger_delivery_config_missing' }
    });
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });

  it('fails with an error a customer can act on when no config matches', async () => {
    let error = await select().catch(error => error);

    expect(error.data).toMatchObject({
      status: 400,
      code: 'trigger_delivery_config_missing',
      message:
        'Delivery is not set up for the OAuth app this connection uses. Finish the delivery setup for this integration, then try again.'
    });
  });

  it('refuses a connection that uses no OAuth app before looking for a config', async () => {
    globalConfig('shared');

    await expect(select({ oauthClientId: undefined })).rejects.toMatchObject({
      data: {
        status: 400,
        code: 'trigger_delivery_oauth_app_required',
        message: 'This trigger needs a connection that uses an OAuth app.'
      }
    });
    expect(mocks.findRegistrations).not.toHaveBeenCalled();
  });

  it('does not report a missing config when a payload cannot be read', async () => {
    globalConfig('shared');
    mocks.decrypt.mockRejectedValue(new Error('secret store unavailable'));

    await expect(select()).rejects.toThrow('secret store unavailable');
  });
});

describe('opening a delivery config', () => {
  it('opens a tenant config as the tenant that owns it', async () => {
    let own = config('own', { tenantOid: 4n });

    await expect(
      service.decryptDeliveryConfig({ registration: own, tenant: { oid: 4n } as any })
    ).resolves.toEqual({ topic: 'own' });
    expect(mocks.decrypt).toHaveBeenCalledWith(
      expect.objectContaining({ secretOid: own.secretOid, tenant: { oid: 4n } })
    );
  });

  it('opens a global config as the global tenant', async () => {
    let shared = globalConfig('shared');

    await expect(
      service.decryptDeliveryConfig({ registration: shared, tenant: { oid: 4n } as any })
    ).resolves.toEqual({ topic: 'shared' });
  });
});
