import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findRegistrations: vi.fn(),
  findTenant: vi.fn(),
  decrypt: vi.fn(),
  authenticate: vi.fn()
}));

vi.mock('../db', () => ({
  db: {
    slateWebhookRegistration: { findMany: mocks.findRegistrations },
    tenant: { findUniqueOrThrow: mocks.findTenant }
  }
}));

vi.mock('./secret', () => ({
  secretService: { DANGEROUSLY_decryptSecret: mocks.decrypt }
}));

vi.mock('./tenant', () => ({ globalTenant: { oid: 99n, identifier: '__slates_global__' } }));

// The selection logic under test is the real package; only the descriptor schema it reads
// from the integration SDK is stood in for, since that build does not load in this runner.
vi.mock('@slates/google-pubsub', async () => {
  let z = (await import('zod')).default;
  let googlePubSubInfrastructureSchema = z.object({
    projectId: z.string().min(1),
    topicName: z.string().min(1),
    subscriptionName: z.string().min(1),
    pushServiceAccountEmail: z.string().min(1),
    audience: z.string().min(1)
  });

  return {
    googlePubSubInfrastructureSchema,
    googlePubSubDeliveryConfigSchema: z.object({
      oauthClientId: z.string().min(1),
      googlePubSub: googlePubSubInfrastructureSchema
    }),
    extractGooglePubSubRoutingKeys: vi.fn(),
    verifyGooglePubSubPush: vi.fn()
  };
});

vi.mock('@slates/managed-trigger-delivery', async importOriginal => ({
  ...(await importOriginal<typeof import('@slates/managed-trigger-delivery')>()),
  authenticateTriggerDelivery: mocks.authenticate
}));

import {
  authenticateTriggerDeliveryConfigPush,
  getTriggerInfrastructure,
  isTriggerDeliveryConfig
} from './triggerInfrastructure';

let clientId = '123.apps.googleusercontent.com';

let descriptor = (name: string) => ({
  projectId: 'project',
  topicName: `projects/project/topics/${name}`,
  subscriptionName: `projects/project/subscriptions/${name}`,
  pushServiceAccountEmail: 'push@project.iam.gserviceaccount.com',
  audience: `https://hooks.example.com/receive/whk_${name}`
});

type Row = {
  id: string;
  oid: bigint;
  type: string;
  status: string;
  owner: 'tenant' | 'global';
  tenantOid: bigint | null;
  slateOid: bigint;
  key: string;
  secretOid: bigint;
  payload: unknown;
};

let rows: Row[];

let config = (name: string, change: Partial<Row> = {}): Row => {
  let oid = BigInt(rows.length + 1);
  let row: Row = {
    id: `whr_${name}`,
    oid,
    type: 'manual',
    status: 'active',
    owner: 'tenant',
    tenantOid: 1n,
    slateOid: 7n,
    key: 'mail',
    secretOid: 100n + oid,
    payload: { oauthClientId: clientId, googlePubSub: descriptor(name) },
    ...change
  };
  rows.push(row);
  return row;
};

let globalConfig = (name: string, change: Partial<Row> = {}) =>
  config(name, { owner: 'global', tenantOid: null, ...change });

let tenant = { oid: 1n } as any;

let managed = { type: 'webhook', googlePubSub: { product: 'gmail' } };

let resolve = (change: Record<string, unknown> = {}) =>
  getTriggerInfrastructure({
    tenant,
    slate: { oid: 7n },
    triggerGroup: { key: 'mail', spec: { invocation: managed } },
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

describe('delivery config resolution', () => {
  it('makes no query for groups without managed delivery', async () => {
    await expect(
      resolve({ triggerGroup: { key: 'mail', spec: { invocation: { type: 'webhook' } } } })
    ).resolves.toBeUndefined();
    expect(mocks.findRegistrations).not.toHaveBeenCalled();
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });

  it('hands out the descriptor saved with the config and names the config as the binding', async () => {
    globalConfig('shared');

    await expect(resolve()).resolves.toEqual({
      bindingId: 'whr_shared',
      infrastructure: { googlePubSub: descriptor('shared') }
    });
    expect(mocks.findRegistrations).toHaveBeenCalledWith({
      where: {
        type: 'manual',
        status: 'active',
        slateOid: 7n,
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

  it('prefers the config of the tenant over the shared one', async () => {
    globalConfig('shared');
    config('own');

    await expect(resolve()).resolves.toMatchObject({ bindingId: 'whr_own' });
  });

  it('falls through to the shared config when the tenant config is for another OAuth app', async () => {
    config('own', {
      payload: { oauthClientId: 'customer-app', googlePubSub: descriptor('own') }
    });
    globalConfig('shared');

    await expect(resolve()).resolves.toMatchObject({ bindingId: 'whr_shared' });
    await expect(resolve({ oauthClientId: 'customer-app' })).resolves.toMatchObject({
      bindingId: 'whr_own'
    });
  });

  it('takes the oldest of several matching configs so adding one changes nothing', async () => {
    config('first');
    config('second');

    await expect(resolve()).resolves.toMatchObject({ bindingId: 'whr_first' });
  });

  it('never chooses or reads the config of another tenant', async () => {
    let foreign = config('foreign', { tenantOid: 2n });

    await expect(resolve()).rejects.toMatchObject({
      data: { code: 'trigger_delivery_config_missing' }
    });
    expect(decryptedSecrets()).not.toContain(foreign.secretOid);

    globalConfig('shared');
    await expect(resolve()).resolves.toMatchObject({ bindingId: 'whr_shared' });
    await expect(resolve({ tenant: { oid: 2n } })).resolves.toMatchObject({
      bindingId: 'whr_foreign'
    });
    expect(decryptedSecrets().filter(oid => oid === foreign.secretOid)).toHaveLength(1);
  });

  it.each([
    ['is still awaiting setup', { status: 'awaiting_setup' }],
    ['was deleted', { status: 'deleted' }],
    ['belongs to another integration', { slateOid: 8n }],
    ['belongs to another trigger group', { key: 'calendar' }],
    ['is an automated registration', { type: 'automated' }]
  ])('ignores a registration that %s', async (_, change) => {
    config('other', change);

    await expect(resolve()).rejects.toMatchObject({
      data: { code: 'trigger_delivery_config_missing' }
    });
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });

  it('fails with an error a customer can act on when no config matches', async () => {
    globalConfig('shared', {
      payload: { oauthClientId: 'other-app', googlePubSub: descriptor('shared') }
    });
    config('broken', { payload: { hook: 42 } });

    let error = await resolve().catch(error => error);

    expect(error.data).toMatchObject({
      status: 400,
      code: 'trigger_delivery_config_missing',
      message:
        'Delivery is not set up for the Google OAuth app this connection uses. Finish the delivery setup for this integration, then try again.'
    });
    expect(error.data.message).not.toMatch(/operator|binding|infrastructure/i);
  });

  it('keeps separate errors for a connection without an OAuth app and an unknown capability', async () => {
    globalConfig('shared');

    await expect(resolve({ oauthClientId: undefined })).rejects.toMatchObject({
      data: {
        code: 'trigger_infrastructure_unavailable',
        message: 'This trigger needs a connection that uses an OAuth app.'
      }
    });
    await expect(
      resolve({
        triggerGroup: {
          key: 'mail',
          spec: { invocation: { type: 'webhook', googlePubSub: { product: 'calendar' } } }
        }
      })
    ).rejects.toMatchObject({
      data: {
        code: 'trigger_infrastructure_unavailable',
        message: 'This trigger requests an unsupported infrastructure capability.'
      }
    });
  });

  it('does not report a missing config when a payload cannot be read', async () => {
    globalConfig('shared');
    mocks.decrypt.mockRejectedValue(new Error('secret store unavailable'));

    await expect(resolve()).rejects.toThrow('secret store unavailable');
  });
});

describe('delivery config identity', () => {
  let registration = (type: 'manual' | 'automated', invocation: unknown) => ({
    type,
    triggerGroup: { spec: { invocation } }
  });

  it('is the registration a person set up for a group with managed delivery', () => {
    expect(isTriggerDeliveryConfig(registration('manual', managed))).toBe(true);
    expect(isTriggerDeliveryConfig(registration('automated', managed))).toBe(false);
    expect(isTriggerDeliveryConfig(registration('manual', { type: 'webhook' }))).toBe(false);
  });
});

describe('delivery config push authentication', () => {
  let request = new Request('https://hooks.example.com/receive/whk_shared', {
    method: 'POST',
    body: '{}'
  });

  beforeEach(() => {
    mocks.authenticate.mockResolvedValue({ ok: true, routingKeys: ['gmail:a@example.com'] });
  });

  it('authenticates a push against the payload of the config it arrived on', async () => {
    let shared = globalConfig('shared');

    await expect(
      authenticateTriggerDeliveryConfigPush({
        registration: { ...shared, triggerGroup: { spec: { invocation: managed } } } as any,
        request
      })
    ).resolves.toEqual({ ok: true, routingKeys: ['gmail:a@example.com'] });
    expect(mocks.authenticate).toHaveBeenCalledWith({
      invocation: managed,
      payload: shared.payload,
      request
    });
    expect(mocks.findTenant).not.toHaveBeenCalled();
  });

  it('opens a tenant config with the tenant that owns it', async () => {
    let own = config('own', { tenantOid: 4n });
    mocks.findTenant.mockResolvedValue({ oid: 4n });

    await authenticateTriggerDeliveryConfigPush({
      registration: { ...own, triggerGroup: { spec: { invocation: managed } } } as any,
      request
    });

    expect(mocks.findTenant).toHaveBeenCalledWith({ where: { oid: 4n } });
    expect(mocks.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ payload: own.payload })
    );
  });
});
