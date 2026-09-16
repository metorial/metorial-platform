import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    shuttleServer: { create: vi.fn() },
    shuttleCustomServer: { create: vi.fn() },
    shuttleCustomServerDeployment: { create: vi.fn() },
    customProvider: { findUniqueOrThrow: vi.fn() }
  },
  getTenantForShuttle: vi.fn(),
  createServer: vi.fn(),
  createVersion: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  snowflake: { nextId: () => 1n }
}));

vi.mock('@metorial-subspace/provider-shuttle/src/client', () => ({
  getTenantForShuttle: mocks.getTenantForShuttle,
  shuttle: {
    server: {
      create: mocks.createServer,
      createVersion: mocks.createVersion
    }
  }
}));

import { backend } from './backend';

let tenant = { oid: 10n, projectOid: 11n } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTenantForShuttle.mockResolvedValue({ id: 'ten_1' });
  mocks.createServer.mockResolvedValue({
    server: { id: 'ser_1', tenantId: 'ten_1', type: 'remote' },
    deployment: { id: 'dep_1' }
  });
  mocks.db.shuttleServer.create.mockResolvedValue({ oid: 20n, id: 'ser_1' });
  mocks.db.shuttleCustomServer.create.mockResolvedValue({ oid: 21n, id: 'ser_1' });
  mocks.db.shuttleCustomServerDeployment.create.mockResolvedValue({
    oid: 22n,
    id: 'dep_1'
  });
});

describe('custom-provider Shuttle deployment', () => {
  it('enables OAuth registration preflight for an initial remote server', async () => {
    await backend.createCustomProvider({
      tenant,
      name: 'Remote provider',
      from: {
        type: 'remote',
        remoteUrl: 'https://example.com/mcp',
        protocol: 'streamable_http'
      },
      config: undefined
    });

    expect(mocks.createServer).toHaveBeenCalledWith(
      expect.objectContaining({ preflightOAuthRegistration: true })
    );
  });

  it('does not send the preflight option for an initial container server', async () => {
    await backend.createCustomProvider({
      tenant,
      name: 'Container provider',
      from: { type: 'container.from_image_ref', imageRef: 'example/image:latest' },
      config: undefined
    });

    expect(mocks.createServer.mock.calls[0]![0]).not.toHaveProperty(
      'preflightOAuthRegistration'
    );
  });

  it('does not send the preflight option for a subsequent remote version', async () => {
    mocks.db.customProvider.findUniqueOrThrow.mockResolvedValue({
      shuttleCustomServer: {
        oid: 21n,
        server: { oid: 20n, id: 'ser_1' }
      }
    });
    mocks.createVersion.mockResolvedValue({ id: 'dep_2' });

    await backend.createCustomProviderVersion({
      tenant,
      customProvider: { oid: 30n } as any,
      from: {
        type: 'remote',
        remoteUrl: 'https://example.com/mcp',
        protocol: 'streamable_http'
      },
      config: undefined
    });

    expect(mocks.createVersion.mock.calls[0]![0]).not.toHaveProperty(
      'preflightOAuthRegistration'
    );
  });
});
