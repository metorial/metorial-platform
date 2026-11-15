import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    shuttleServerVersion: { findUniqueOrThrow: vi.fn() },
    shuttleServerConfig: { findUniqueOrThrow: vi.fn() }
  },
  getTenantForShuttle: vi.fn(),
  getServerVersion: vi.fn(),
  getServer: vi.fn(),
  createDiscovery: vi.fn(),
  getDiscovery: vi.fn()
}));

vi.mock('@lowerdeck/delay', () => ({ delay: vi.fn() }));

vi.mock('@metorial-subspace/db', () => ({ db: mocks.db }));

vi.mock('../client', () => ({
  getTenantForShuttle: mocks.getTenantForShuttle,
  shuttleDefaultReaderTenant: {},
  shuttle: {
    serverVersion: { get: mocks.getServerVersion },
    server: { get: mocks.getServer },
    serverDiscovery: { create: mocks.createDiscovery, get: mocks.getDiscovery }
  }
}));

vi.mock('../lib/serverTypes', () => ({
  resolveConnectionSpecificationBehavior: vi.fn()
}));

import { ProviderCapabilities } from './capabilities';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTenantForShuttle.mockResolvedValue({ id: 'ten_1' });
  mocks.db.shuttleServerVersion.findUniqueOrThrow.mockResolvedValue({
    id: 'svr_1',
    server: { id: 'ser_1' }
  });
  mocks.db.shuttleServerConfig.findUniqueOrThrow.mockResolvedValue({ id: 'cfg_1' });

  mocks.getServerVersion.mockResolvedValue({});
  mocks.getServer.mockResolvedValue({});
  mocks.createDiscovery.mockResolvedValue({ id: 'dis_1', status: 'pending' });
});

describe('failed specification discovery', () => {
  it.each([
    {
      error: { type: 'timeout_error', message: 'Discovery timed out' },
      expected: { type: 'timeout_error', message: 'Discovery timed out' }
    },
    {
      error: null,
      expected: {
        type: 'connection_error',
        error: {
          code: 'discovery_failed',
          message: 'MCP server discovery failed without error details'
        }
      }
    }
  ])(
    'returns error details when the discovery error is $error',
    async ({ error, expected }) => {
      let warnings = [{ code: 'invalid_response', message: 'Invalid tool response' }];
      mocks.getDiscovery.mockResolvedValue({
        id: 'dis_1',
        status: 'failed',
        warnings,
        error
      });

      let result = await new ProviderCapabilities({
        backend: {} as any
      }).getSpecificationForProviderPair({
        tenant: { id: 'ten_1' },
        providerVersion: { shuttleServerVersionOid: 1n },
        configVersion: { shuttleConfigOid: 2n },
        authConfigVersion: null
      } as any);

      expect(result).toEqual({ status: 'failure', warnings, error: expected });
    }
  );
});
