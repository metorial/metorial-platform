import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => {
  let db = {
    magicMcpToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    magicMcpTokenUse: {
      createMany: vi.fn()
    },
    magicMcpServer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn()
    },
    magicMcpEndpoint: {
      findUnique: vi.fn(),
      findFirst: vi.fn()
    },
    magicMcpEndpointServer: {
      count: vi.fn()
    },
    magicMcpGroup: {
      findMany: vi.fn()
    },
    magicMcpGroupToken: {
      count: vi.fn(),
      createMany: vi.fn()
    },
    magicMcpGroupServer: {
      createMany: vi.fn()
    },
    accessTagEntity: {
      findMany: vi.fn()
    }
  };

  return {
    db,
    ID: {
      generateId: vi.fn().mockResolvedValue('magic-id')
    },
    withTransaction: vi.fn(callback => callback(db))
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn)
  }
}));

vi.mock('@metorial/api-keys', () => ({
  UnifiedApiKey: {
    create: vi.fn(() => ({
      toString: () => 'magic-secret'
    }))
  }
}));

vi.mock('@metorial/config', () => ({
  getConfig: () => ({
    urls: {
      apiUrl: 'https://api.test'
    }
  })
}));

vi.mock('@metorial/module-access', () => ({
  accessTagService: {
    checkResourceAccess: vi.fn(),
    getAccessTagFilter: vi.fn()
  },
  consumerMagicMcpConnectRoles: ['magic:connect'],
  consumerMagicMcpReadRoles: ['magic:read'],
  consumerMagicMcpWriteRoles: ['magic:write']
}));

vi.mock('@metorial/module-search', () => ({
  searchMagicMcpGroupIds: vi.fn()
}));

vi.mock('@metorial/id', () => ({
  generatePlainId: vi.fn(() => 'plainid')
}));

vi.mock('@lowerdeck/slugify', () => ({
  slugify: vi.fn((value?: string | null) =>
    (value ?? 'group').toLowerCase().trim().replace(/\s+/g, '-')
  )
}));

vi.mock('../src/env', () => ({
  env: {
    service: {
      METORIAL_REGION: 'us1'
    }
  }
}));

vi.mock('../src/queues/lifecycle/magicMcpGroup', () => ({
  enqueueMagicMcpGroupCreated: vi.fn(),
  enqueueMagicMcpGroupDeleted: vi.fn(),
  enqueueMagicMcpGroupUpdated: vi.fn()
}));

import { db } from '@metorial/db';
import { magicMcpGroupService } from '../src/services/magicMcpGroup';
import { magicMcpTokenService } from '../src/services/magicMcpToken';

describe('magic MCP link guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects creating a token linked to an inactive server', async () => {
    await expect(
      magicMcpTokenService.createMagicMcpToken({
        instance: { oid: 1n } as any,
        input: {
          name: 'Portal token',
          magicMcpServer: {
            oid: 2n,
            status: 'deleted'
          } as any
        }
      })
    ).rejects.toThrow('no longer active');

    expect(db.magicMcpToken.create).not.toHaveBeenCalled();
  });

  it('rejects resolving a token whose linked endpoint has inactive servers', async () => {
    vi.mocked(db.magicMcpToken.findFirst).mockResolvedValue({
      oid: 10n,
      id: 'magic-token-1',
      secret: 'magic-secret',
      status: 'active',
      instanceOid: 1n,
      magicMcpServerOid: null,
      magicMcpEndpointOid: 20n,
      isGroupLocked: false,
      expiresAt: null,
      magicMcpServer: null,
      magicMcpEndpoint: {
        oid: 20n,
        status: 'active',
        servers: []
      },
      groups: []
    } as any);
    vi.mocked(db.magicMcpEndpoint.findUnique).mockResolvedValue({
      oid: 20n,
      status: 'active'
    } as any);
    vi.mocked(db.magicMcpEndpointServer.count).mockResolvedValue(1);

    await expect(
      magicMcpTokenService.getMagicMcpTokenBySecret({
        secret: 'magic-secret',
        instance: { oid: 1n } as any
      })
    ).rejects.toThrow('inactive servers');
  });

  it('rejects linking an inactive server to a group', async () => {
    vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([
      {
        oid: 5n,
        id: 'magic-server-1',
        status: 'deleted'
      }
    ] as any);

    await expect(
      magicMcpGroupService.addServersToGroup({
        group: {
          oid: 7n,
          instanceOid: 1n,
          status: 'active'
        } as any,
        serverIds: ['magic-server-1']
      })
    ).rejects.toThrow('only be linked to active magic MCP servers');

    expect(db.magicMcpGroupServer.createMany).not.toHaveBeenCalled();
  });

  it('records a token use once per target, ip, ua and hour', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T12:34:56.000Z'));

    vi.mocked(db.magicMcpTokenUse.createMany).mockResolvedValue({ count: 1 } as any);

    await magicMcpTokenService.recordMagicMcpTokenUse({
      token: { oid: 10n } as any,
      server: { oid: 20n } as any,
      ip: '203.0.113.10',
      ua: null
    });

    expect(db.magicMcpTokenUse.createMany).toHaveBeenCalledWith({
      data: [
        {
          magicMcpTokenOid: 10n,
          magicMcpServerOid: 20n,
          magicMcpEndpointOid: undefined,
          magicMcpTarget: 'sk',
          ip: '203.0.113.10',
          ua: '',
          hour: new Date('2026-04-08T12:00:00.000Z')
        }
      ],
      skipDuplicates: true
    });

    vi.useRealTimers();
  });
});
