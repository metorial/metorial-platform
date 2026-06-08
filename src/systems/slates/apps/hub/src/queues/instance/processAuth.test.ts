import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues: Record<string, any> = {};

let slateAuthConfigFindFirst = vi.fn();
let slateAuthConfigUpdateMany = vi.fn();
let slateVersionFindUnique = vi.fn();
let decryptSecret = vi.fn();
let updateSecret = vi.fn();
let createInvocation = vi.fn();
let getAuthOutput = vi.fn();
let sendUpdatedAuthInput = vi.fn();
let updateProfileQueueAdd = vi.fn();

let db = {
  slateAuthConfig: {
    findFirst: slateAuthConfigFindFirst,
    updateMany: slateAuthConfigUpdateMany
  },
  slateVersion: {
    findUnique: slateVersionFindUnique
  }
};

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class QueueRetryError extends Error {},
  createQueue: (opts: { name: string }) => {
    let queue = {
      add: vi.fn(),
      process: vi.fn((processor: unknown) => {
        queue.processor = processor;
        return { name: opts.name };
      }),
      processor: undefined as unknown
    };
    queues[opts.name] = queue;
    return queue;
  }
}));

vi.mock('../../db', () => ({
  db
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../../services', () => ({
  secretService: {
    DANGEROUSLY_decryptSecret: decryptSecret,
    DANGEROUSLY_updateSecret: updateSecret
  },
  slateErrorService: {
    recordSlateError: vi.fn()
  },
  slateInvocationService: {
    createInvocation,
    getAuthOutput,
    sendUpdatedAuthInput
  }
}));

vi.mock('./updateProfile', () => ({
  updateProfileQueue: {
    add: updateProfileQueueAdd
  }
}));

describe('processAuthQueueProcessor', () => {
  beforeEach(() => {
    vi.resetModules();
    queues = {};
    slateAuthConfigFindFirst.mockReset();
    slateAuthConfigUpdateMany.mockReset();
    slateVersionFindUnique.mockReset();
    decryptSecret.mockReset();
    updateSecret.mockReset();
    createInvocation.mockReset();
    getAuthOutput.mockReset();
    sendUpdatedAuthInput.mockReset();
    updateProfileQueueAdd.mockReset();
  });

  it('stores non-empty getOutput scopes as granted scopes', async () => {
    await import('./processAuth');

    slateAuthConfigFindFirst.mockResolvedValue({
      oid: 1n,
      id: 'slateAuthConfig_1',
      secretOid: 2n,
      tokenExpiresAt: undefined,
      authMethod: {
        key: 'token_auth',
        spec: {
          capabilities: {
            handleChangedInput: { enabled: false },
            getProfile: { enabled: false }
          }
        }
      },
      oauthCredentials: null,
      instance: null,
      slate: {
        oid: 3n,
        currentVersionOid: 4n
      },
      tenant: {
        oid: 5n
      }
    });
    slateVersionFindUnique.mockResolvedValue({ oid: 4n });
    decryptSecret.mockResolvedValue({
      input: {
        token: 'token'
      }
    });
    createInvocation.mockResolvedValue({ id: 'stack' });
    getAuthOutput.mockResolvedValue({
      status: 'success',
      data: {
        output: {
          token: 'token'
        },
        scopes: ['scope:read']
      }
    });

    await queues['shub/soat/procAuth'].processor({ configId: 'slateAuthConfig_1' });

    expect(updateSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        secretData: {
          input: {
            token: 'token'
          },
          output: {
            token: 'token'
          }
        }
      })
    );
    expect(slateAuthConfigUpdateMany).toHaveBeenLastCalledWith({
      where: { oid: 1n },
      data: {
        isProcessing: false,
        errorCode: null,
        errorMessage: null,
        errorInvocationId: null,
        grantedScopes: ['scope:read']
      }
    });
  });
});
