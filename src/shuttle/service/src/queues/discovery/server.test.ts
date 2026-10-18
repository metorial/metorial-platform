import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues: Record<string, any> = {};

let serverDiscoveryFindFirst = vi.fn();
let serverDiscoveryUpdate = vi.fn();
let serverSpecificationUpsert = vi.fn();
let serverVersionUpdate = vi.fn();
let createServerConnection = vi.fn();
let createEmbeddedConnection = vi.fn();
let client: any;

let db = {
  serverDiscovery: {
    findFirst: serverDiscoveryFindFirst,
    update: serverDiscoveryUpdate
  },
  serverSpecification: {
    upsert: serverSpecificationUpsert
  },
  serverVersion: {
    update: serverVersionUpdate
  }
};

vi.mock('@lowerdeck/delay', () => ({
  delay: () => new Promise(() => {})
}));

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

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn() })
}));

vi.mock('../../db', () => ({ db }));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../../id', () => ({
  getId: (model: string) => ({ oid: 100n, id: `${model}_id` })
}));

vi.mock('../../mcp/connection/embedded', () => ({
  EmbeddedConnection: {
    create: createEmbeddedConnection
  },
  EmbeddedConnectionError: class EmbeddedConnectionError extends Error {
    constructor(
      readonly code = 'connection_error',
      message = 'Connection failed'
    ) {
      super(message);
    }
  }
}));

vi.mock('../../mcp/utils/paginate', () => ({
  autoPaginateMcp: async (fn: (cursor?: string) => Promise<unknown>) => [await fn(undefined)]
}));

vi.mock('../../services', () => ({
  serverConnectionService: {
    createServerConnection
  }
}));

let discovery = {
  oid: 1n,
  id: 'server_discovery_1',
  tenant: { oid: 2n, id: 'tenant_1' },
  serverConfig: { oid: 3n },
  serverAuthConfig: null,
  serverVersion: {
    oid: 4n,
    id: 'server_version_1',
    serverOid: 5n,
    remoteProtocolAutoSwitchStatus: 'none',
    remoteProtocol: 'streamable_http',
    originalRemoteProtocol: null,
    server: {
      oid: 5n,
      type: 'container'
    }
  }
};

describe('discoverServerQueueProcessor', () => {
  beforeEach(() => {
    vi.resetModules();
    queues = {};

    serverDiscoveryFindFirst.mockReset();
    serverDiscoveryUpdate.mockReset();
    serverSpecificationUpsert.mockReset();
    serverVersionUpdate.mockReset();
    createServerConnection.mockReset();
    createEmbeddedConnection.mockReset();

    client = {
      getServerCapabilities: vi.fn().mockResolvedValue({ tools: {} }),
      getServerVersion: vi.fn().mockResolvedValue({ name: 'remote', version: '1.0.0' }),
      getInstructions: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn(),
      terminate: vi.fn()
    };

    serverDiscoveryFindFirst.mockResolvedValue(discovery);
    createServerConnection.mockResolvedValue({ oid: 6n });
    createEmbeddedConnection.mockResolvedValue(client);
    serverSpecificationUpsert.mockResolvedValue({ oid: 7n });
  });

  it('fails discovery when an advertised tools/list call fails', async () => {
    await import('./server');
    client.listTools.mockRejectedValue(new Error('MCP error -32601: method does not exist'));

    await queues['shut/server/discover'].processor({
      serverDiscoveryId: discovery.id
    });

    expect(serverSpecificationUpsert).not.toHaveBeenCalled();
    expect(serverDiscoveryUpdate).toHaveBeenCalledWith({
      where: { oid: discovery.oid },
      data: expect.objectContaining({
        status: 'failed',
        warnings: [
          expect.objectContaining({
            code: 'invalid_response'
          })
        ]
      })
    });
  });

  it('succeeds discovery when an advertised tools/list call returns an empty list', async () => {
    await import('./server');
    client.listTools.mockResolvedValue({ tools: [] });

    await queues['shut/server/discover'].processor({
      serverDiscoveryId: discovery.id
    });

    expect(serverSpecificationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          value: expect.objectContaining({
            tools: []
          })
        })
      })
    );
    expect(serverDiscoveryUpdate).toHaveBeenCalledWith({
      where: { oid: discovery.oid },
      data: expect.objectContaining({
        status: 'succeeded',
        specificationOid: 7n,
        warnings: []
      })
    });
  });

  it.each([
    ['streamable_http', 'stateless_protocol_detected', 'stateless'],
    ['streamable_http', 'connection_error', 'sse'],
    ['stateless', 'stateless_protocol_unsupported', 'streamable_http'],
    ['sse', 'connection_error', 'streamable_http']
  ])(
    'auto-switches a failing %s remote server with %s to %s',
    async (remoteProtocol, errorCode, expectedProtocol) => {
      let { EmbeddedConnectionError } = await import('../../mcp/connection/embedded');
      await import('./server');

      serverDiscoveryFindFirst.mockResolvedValue({
        ...discovery,
        serverVersion: {
          ...discovery.serverVersion,
          remoteProtocol,
          server: { oid: 5n, type: 'remote' }
        }
      });
      createEmbeddedConnection.mockRejectedValue(new EmbeddedConnectionError(errorCode));

      await queues['shut/server/discover'].processor({
        serverDiscoveryId: discovery.id
      });

      expect(serverVersionUpdate).toHaveBeenCalledWith({
        where: { oid: discovery.serverVersion.oid },
        data: {
          remoteProtocolAutoSwitchStatus: 'attempting',
          originalRemoteProtocol: remoteProtocol,
          remoteProtocol: expectedProtocol
        }
      });
      expect(queues['shut/server/discover'].add).toHaveBeenCalledWith({
        serverDiscoveryId: discovery.id,
        _remote: { isAutoSwitched: true }
      });
      expect(serverDiscoveryUpdate).not.toHaveBeenCalled();
    }
  );
});
