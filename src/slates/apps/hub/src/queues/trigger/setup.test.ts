import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues = new Map<string, any>();
let db = {
  triggerRegistrationInstance: { findUnique: vi.fn(), findMany: vi.fn() },
  slateWebhookRegistration: { findMany: vi.fn(), findUnique: vi.fn() },
  triggerRegistrationWebhook: { create: vi.fn(), deleteMany: vi.fn() }
};
let decrypt = vi.fn();
let invocation = { createInvocationWithState: vi.fn(), getRoutingMatchers: vi.fn() };
let matchers = { countInstanceMatchers: vi.fn(), setInstanceMatchers: vi.fn() };
let instanceError = vi.fn();
class RetryError extends Error {}

vi.mock('@lowerdeck/queue', () => ({
  createQueue: ({ name }: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      process: (handler: any) => {
        queue.handler = handler;
        return queue;
      },
      handler: null as any
    };
    queues.set(name, queue);
    return queue;
  },
  QueueRetryError: RetryError
}));
vi.mock('../../db', () => ({ db }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://unused' } } }));
vi.mock('../../id', () => ({
  getId: () => ({ id: 'generated', oid: 9n }),
  snowflake: { nextId: () => 10n }
}));
vi.mock('../../lib/slateVersion', () => ({
  getActiveSlateVersion: vi.fn(async () => ({ id: 'version' }))
}));
vi.mock('../../services/secret', () => ({
  secretService: { DANGEROUSLY_decryptSecret: decrypt }
}));
vi.mock('../../services/slateInvocation', () => ({ slateInvocationService: invocation }));
vi.mock('../../internal/triggerRoutingMatcherServiceInternal', () => ({
  triggerRoutingMatcherServiceInternal: matchers
}));
vi.mock('./_instanceError', () => ({ createTriggerRegistrationInstanceError: instanceError }));
vi.mock('./webhookTargetSearch', () => ({
  triggerWebhookTargetSearchQueue: { add: vi.fn() }
}));

let authConfig: any;
let run = () =>
  queues.get('shub/trg/inst/setup/1').handler({ triggerRegistrationInstanceId: 'inst' });

beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  queues.clear();
  authConfig = {
    isProcessing: false,
    routingMatchers: null,
    secretOid: 5n,
    authMethodOid: 6n,
    oauthCredentialsOid: null,
    authMethod: { key: 'chatbot' }
  };
  db.triggerRegistrationInstance.findUnique.mockImplementation(async () => ({
    id: 'inst',
    oid: 3n,
    triggerGroupOid: 4n,
    triggerGroup: {
      oid: 4n,
      key: 'chatbot_events',
      spec: { invocation: { type: 'webhook', registration: { mode: 'manual' } } }
    },
    triggerRegistration: {
      status: 'active',
      tenantOid: 1n,
      tenant: { oid: 1n },
      slate: {},
      instance: {},
      instanceConfig: { value: {} },
      authConfig
    },
    schedule: null,
    gateway: null
  }));
  matchers.countInstanceMatchers.mockResolvedValue(0);
  matchers.setInstanceMatchers.mockImplementation(async ({ matchers }) => matchers.length);
  decrypt.mockResolvedValue({
    input: { clientId: 'id' },
    output: { token: 't', botJid: 'bot' }
  });
  invocation.createInvocationWithState.mockResolvedValue({});
  invocation.getRoutingMatchers.mockResolvedValue({
    status: 'success',
    data: { matchers: [{ botJid: 'bot' }] }
  });
  db.slateWebhookRegistration.findMany.mockResolvedValue([
    { oid: 7n, owner: 'tenant', authRouting: 'any', authMethods: [], oauthCredentials: [] }
  ]);
  await import('./setup');
});

describe('manual webhook trigger setup', () => {
  it('retries while the auth config is still processing, without fetching matchers', async () => {
    authConfig.isProcessing = true;

    await expect(run()).rejects.toBeInstanceOf(RetryError);

    expect(decrypt).not.toHaveBeenCalled();
    expect(invocation.getRoutingMatchers).not.toHaveBeenCalled();
    expect(instanceError).not.toHaveBeenCalled();
    expect(db.triggerRegistrationWebhook.create).not.toHaveBeenCalled();
  });

  it('fetches matchers with the processed output and links the registration', async () => {
    await run();

    expect(invocation.createInvocationWithState).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { authenticationMethodId: 'chatbot', data: { token: 't', botJid: 'bot' } }
      })
    );
    expect(instanceError).not.toHaveBeenCalled();
    expect(db.triggerRegistrationWebhook.create).toHaveBeenCalledWith({
      data: { oid: 10n, triggerRegistrationInstanceOid: 3n, webhookRegistrationOid: 7n }
    });
  });

  it.each([11n, 12n])(
    'selects only the matching app receiver for credential %s',
    async credentialOid => {
      authConfig.oauthCredentialsOid = credentialOid;
      db.slateWebhookRegistration.findMany.mockResolvedValue([
        {
          oid: 7n,
          owner: 'tenant',
          authRouting: 'any',
          authMethods: [],
          oauthCredentials: []
        },
        ...[11n, 12n].map(oid => ({
          oid: oid + 100n,
          owner: 'tenant',
          authRouting: 'restricted_credential',
          authMethods: [],
          oauthCredentials: [{ oauthCredentialsOid: oid }]
        }))
      ]);

      await run();

      expect(db.triggerRegistrationWebhook.create).toHaveBeenCalledWith({
        data: {
          oid: 10n,
          triggerRegistrationInstanceOid: 3n,
          webhookRegistrationOid: credentialOid + 100n
        }
      });
      expect(db.triggerRegistrationWebhook.deleteMany).toHaveBeenCalledWith({
        where: {
          triggerRegistrationInstanceOid: 3n,
          triggerWebhookTargetOid: null,
          webhookRegistrationOid: { not: credentialOid + 100n }
        }
      });
    }
  );

  it('does not attach a trigger to another app when there is no fallback', async () => {
    authConfig.oauthCredentialsOid = 12n;
    db.slateWebhookRegistration.findMany.mockResolvedValue([
      {
        oid: 111n,
        owner: 'tenant',
        authRouting: 'restricted_credential',
        oauthCredentials: [{ oauthCredentialsOid: 11n }]
      }
    ]);

    await run();

    expect(db.triggerRegistrationWebhook.create).not.toHaveBeenCalled();
    expect(instanceError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'no_matching_webhook_registration' })
    );
  });

  it('removes an old shared link even when the scoped link already exists', async () => {
    db.triggerRegistrationWebhook.create.mockRejectedValue({ code: 'P2002' });

    await run();

    expect(db.triggerRegistrationWebhook.deleteMany).toHaveBeenCalled();
  });

  it('preserves the old link if provisioning the replacement fails', async () => {
    db.triggerRegistrationWebhook.create.mockRejectedValue(new Error('database unavailable'));

    await expect(run()).rejects.toThrow('database unavailable');

    expect(db.triggerRegistrationWebhook.deleteMany).not.toHaveBeenCalled();
  });

  it('rematches already-linked instances for a newly activated app credential', async () => {
    db.slateWebhookRegistration.findUnique.mockResolvedValue({
      triggerGroupOid: 4n,
      tenantOid: 1n,
      owner: 'tenant',
      authRouting: 'restricted_credential',
      oauthCredentials: [{ oauthCredentialsOid: 12n }]
    });
    db.triggerRegistrationInstance.findMany.mockResolvedValue([{ id: 'existing_instance' }]);
    await import('./webhookRegistrationRematch');

    await queues
      .get('shub/trg/whk/rematch/1')
      .handler({ webhookRegistrationId: 'new_receiver' });

    expect(db.triggerRegistrationInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          triggerRegistration: { tenantOid: 1n },
          triggerGroupOid: 4n,
          OR: [
            { webhooks: { none: {} } },
            { triggerRegistration: { authConfig: { oauthCredentialsOid: { in: [12n] } } } }
          ]
        })
      })
    );
    expect(queues.get('shub/trg/inst/setup/1').addManyWithOps).toHaveBeenCalledWith([
      {
        data: { triggerRegistrationInstanceId: 'existing_instance' },
        opts: { id: 'existing_instance' }
      }
    ]);
  });

  it('uses stored routing matchers even while the config is processing', async () => {
    authConfig.isProcessing = true;
    authConfig.routingMatchers = [{ botJid: 'bot' }];

    await run();

    expect(decrypt).not.toHaveBeenCalled();
    expect(db.triggerRegistrationWebhook.create).toHaveBeenCalled();
  });
});
