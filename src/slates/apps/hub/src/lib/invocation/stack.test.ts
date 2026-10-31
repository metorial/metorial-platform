import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  env: { storage: {}, service: {} as Record<string, string | undefined> },
  createInvocation: vi.fn(),
  generateId: vi.fn(),
  nextOid: vi.fn(),
  invokeFunction: vi.fn(),
  storeInvocation: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn(), captureMessage: vi.fn() })
}));

vi.mock('../../db', () => ({
  db: { slateInvocation: { create: mocks.createInvocation } }
}));

vi.mock('../../env', () => ({ env: mocks.env }));

vi.mock('../../functionBay', () => ({
  functionBay: { function: { invoke: mocks.invokeFunction } },
  functionBayTenant: Promise.resolve({ id: 'tenant_1' })
}));

vi.mock('../../hub', () => ({ hub: { identifier: 'hub_1' } }));

vi.mock('../../id', () => ({
  ID: { generateId: mocks.generateId },
  snowflake: { nextId: mocks.nextOid }
}));

vi.mock('../../storage', () => ({ invocationsBucketRecord: { oid: 1 } }));

vi.mock('./liveToken', () => ({ mintLiveInvocationToken: vi.fn() }));

vi.mock('./store', () => ({ storeSlateInvocation: mocks.storeInvocation }));

import { SlateInvocationStack } from './stack';

let invoke = (capabilities?: { hub?: { runtimeInfo?: boolean } }) =>
  new SlateInvocationStack({
    slateVersion: {
      id: 'version_1',
      activeDeploymentOid: 20n,
      providerDeploymentInfo: { functionId: 'function_1' }
    } as any,
    participants: [],
    capabilities
  }).invoke('slates/provider.identify', {});

let sentMessages = () =>
  mocks.invokeFunction.mock.calls.at(-1)![0].payload.messages as {
    method: string;
    params: unknown;
  }[];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.service = {};

  let oid = 10n;
  mocks.nextOid.mockImplementation(() => oid++);
  mocks.generateId.mockResolvedValue('shiv_1');
  mocks.createInvocation.mockImplementation(async ({ data }) => ({
    ...data,
    createdAt: new Date()
  }));

  mocks.invokeFunction.mockImplementation(async ({ payload }) => ({
    id: 'provider_invocation_1',
    type: 'success',
    result: {
      messages: payload.messages
        .filter((message: { id?: string }) => message.id)
        .map((message: { id: string }) => ({
          jsonrpc: '2.0',
          id: message.id,
          result: { provider: { name: 'Test Provider' } }
        }))
    }
  }));
  mocks.storeInvocation.mockResolvedValue(undefined);
});

describe('SlateInvocationStack invocation record creation', () => {
  it('regenerates a colliding oid while preserving the public invocation id', async () => {
    mocks.createInvocation.mockRejectedValueOnce({
      code: 'P2002',
      meta: { modelName: 'SlateInvocation', target: 'SlateInvocation_pkey' }
    });

    let result = await invoke();

    expect(result.status).toBe('success');
    expect(result.invocation).toMatchObject({ oid: 11n, id: 'shiv_1' });
    expect(mocks.createInvocation.mock.calls.map(([input]) => input.data.oid)).toEqual([
      10n,
      11n
    ]);
    expect(mocks.createInvocation.mock.calls.map(([input]) => input.data.id)).toEqual([
      'shiv_1',
      'shiv_1'
    ]);
    expect(mocks.generateId).toHaveBeenCalledTimes(1);

    expect(mocks.invokeFunction).toHaveBeenCalledTimes(1);
    expect(mocks.invokeFunction).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ invocationId: 'shiv_1' }) })
    );
    expect(mocks.storeInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ record: expect.objectContaining({ oid: 11n, id: 'shiv_1' }) })
    );
  });

  it('stops after three collisions without invoking the provider', async () => {
    let error = { code: 'P2002', meta: { target: ['oid'] } };
    mocks.createInvocation.mockRejectedValue(error);

    await expect(invoke()).rejects.toBe(error);

    expect(mocks.createInvocation.mock.calls.map(([input]) => input.data.oid)).toEqual([
      10n,
      11n,
      12n
    ]);
    expect(mocks.invokeFunction).not.toHaveBeenCalled();
    expect(mocks.storeInvocation).not.toHaveBeenCalled();
  });

  it('propagates other database errors without retrying or invoking the provider', async () => {
    let error = { code: 'P2003' };
    mocks.createInvocation.mockRejectedValue(error);

    await expect(invoke()).rejects.toBe(error);

    expect(mocks.createInvocation).toHaveBeenCalledTimes(1);
    expect(mocks.invokeFunction).not.toHaveBeenCalled();
    expect(mocks.storeInvocation).not.toHaveBeenCalled();
  });
});

describe('SlateInvocationStack runtime info', () => {
  beforeEach(() => {
    mocks.env.service = {
      METORIAL_API_URL: 'https://api-eu1.metorial.test',
      METORIAL_REGION: 'eu1',
      METORIAL_ENV: 'staging'
    };
  });

  it('tells slates that support it which Metorial environment runs them', async () => {
    await invoke({ hub: { runtimeInfo: true } });

    expect(
      sentMessages().find(message => message.method === 'slates/hub.runtime_info.set')
    ).toEqual({
      jsonrpc: '2.0',
      method: 'slates/hub.runtime_info.set',
      params: {
        runtimeInfo: {
          metorial: {
            apiUrl: 'https://api-eu1.metorial.test',
            region: 'eu1',
            environment: 'staging'
          }
        }
      }
    });
  });

  it('skips runtime info for slates that do not advertise support', async () => {
    await invoke();

    expect(sentMessages().map(message => message.method)).not.toContain(
      'slates/hub.runtime_info.set'
    );
  });

  it('skips runtime info when the hub has no Metorial API URL configured', async () => {
    mocks.env.service.METORIAL_API_URL = undefined;
    await invoke({ hub: { runtimeInfo: true } });

    expect(sentMessages().map(message => message.method)).not.toContain(
      'slates/hub.runtime_info.set'
    );
  });

  it('refuses to send a plain http Metorial API URL outside development', async () => {
    mocks.env.service.METORIAL_API_URL = 'http://api-eu1.metorial.test';

    await expect(invoke({ hub: { runtimeInfo: true } })).rejects.toThrow(
      'METORIAL_API_URL must be an absolute https URL'
    );
  });
});
