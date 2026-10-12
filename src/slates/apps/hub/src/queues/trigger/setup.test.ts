import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues = new Map<string, any>();
let db = {
  triggerRegistrationInstance: { findUnique: vi.fn() },
  slateWebhookRegistration: { findMany: vi.fn() },
  triggerRegistrationWebhook: { create: vi.fn() }
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

  it('uses stored routing matchers even while the config is processing', async () => {
    authConfig.isProcessing = true;
    authConfig.routingMatchers = [{ botJid: 'bot' }];

    await run();

    expect(decrypt).not.toHaveBeenCalled();
    expect(db.triggerRegistrationWebhook.create).toHaveBeenCalled();
  });
});
