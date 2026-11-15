import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => {
  let db = {
    consumerAuthAttempt: {
      updateMany: vi.fn()
    },
    consumerToken: {
      findFirst: vi.fn(),
      upsert: vi.fn()
    },
    consumerIntegration: {
      upsert: vi.fn(),
      update: vi.fn()
    },
    consumerIntegrationEndpoint: {
      upsert: vi.fn()
    },
    consumerIntegrationSession: {
      upsert: vi.fn()
    },
    magicMcpToken: {
      updateMany: vi.fn()
    },
    magicMcpServer: {
      updateMany: vi.fn()
    },
    magicMcpEndpoint: {
      updateMany: vi.fn()
    },
    magicMcpSession: {
      updateMany: vi.fn()
    }
  };

  return {
    db,
    ID: {
      generateId: vi.fn(async prefix => `${prefix}-id`)
    },
    withTransaction: vi.fn(async callback => await callback(db))
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

import { db, withTransaction } from '@metorial/db';
import { consumerIntegrationService } from '../src/services/consumerIntegration';

describe('consumerIntegrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fans out endpoint-backed sessions to one managed integration per server', async () => {
    (db.consumerIntegrationEndpoint.upsert as any).mockResolvedValue({
      id: 'consumerIntegrationEndpoint-1'
    } as any);
    (db.consumerIntegration.upsert as any)
      .mockResolvedValueOnce({
        oid: 101n,
        id: 'consumerIntegration-1',
        instanceOid: 10n,
        consumerOid: 20n,
        consumerProfileOid: 30n
      } as any)
      .mockResolvedValueOnce({
        oid: 102n,
        id: 'consumerIntegration-2',
        instanceOid: 10n,
        consumerOid: 20n,
        consumerProfileOid: 30n
      } as any);
    (db.consumerIntegrationSession.upsert as any)
      .mockResolvedValueOnce({
        id: 'consumerIntegrationSession-1'
      } as any)
      .mockResolvedValueOnce({
        id: 'consumerIntegrationSession-2'
      } as any);

    let result = await consumerIntegrationService.materializeMagicMcpSessionOwnership({
      consumerProfile: {
        oid: 30n,
        instanceOid: 10n,
        consumerOid: 20n
      },
      magicMcpTarget: {
        type: 'endpoint',
        target: {
          oid: 40n,
          instanceOid: 10n,
          consumerProfileOid: null,
          servers: [
            {
              magicMcpServerOid: 50n,
              magicMcpServer: {
                oid: 50n,
                instanceOid: 10n
              }
            },
            {
              magicMcpServerOid: 60n,
              magicMcpServer: {
                oid: 60n,
                instanceOid: 10n
              }
            }
          ]
        }
      } as any,
      magicMcpSession: {
        oid: 70n,
        instanceOid: 10n
      }
    });

    expect(db.consumerIntegrationEndpoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          magicMcpEndpointOid: 40n,
          isManaged: true
        })
      })
    );
    expect(db.consumerIntegration.upsert).toHaveBeenCalledTimes(2);
    expect(db.consumerIntegration.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({
          magicMcpServerOid: 50n,
          isManaged: true
        })
      })
    );
    expect(db.consumerIntegration.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          magicMcpServerOid: 60n,
          isManaged: true
        })
      })
    );
    expect(db.consumerIntegrationSession.upsert).toHaveBeenCalledTimes(2);
    expect(result.consumerIntegrationSessions).toHaveLength(2);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('forces managed integrations back to owned when explicitly created by a consumer', async () => {
    (db.consumerIntegration.upsert as any).mockResolvedValue({
      id: 'consumerIntegration-1'
    } as any);

    await consumerIntegrationService.upsertConsumerIntegration({
      consumerProfile: {
        oid: 30n,
        instanceOid: 10n,
        consumerOid: 20n
      },
      magicMcpServer: {
        oid: 50n,
        instanceOid: 10n
      },
      isManaged: false
    });

    expect(db.consumerIntegration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isManaged: false
        })
      })
    );
  });

  it('updates the existing integration when a concurrent upsert wins the insert race', async () => {
    (db.consumerIntegration.upsert as any).mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['consumerProfileOid', 'magicMcpServerOid']
      }
    });
    (db.consumerIntegration.update as any).mockResolvedValue({
      id: 'consumerIntegration-1'
    } as any);

    await consumerIntegrationService.upsertConsumerIntegration({
      consumerProfile: {
        oid: 30n,
        instanceOid: 10n,
        consumerOid: 20n
      },
      magicMcpServer: {
        oid: 50n,
        instanceOid: 10n
      },
      isManaged: true
    });

    expect(db.consumerIntegration.update).toHaveBeenCalledWith({
      where: {
        consumerProfileOid_magicMcpServerOid: {
          consumerProfileOid: 30n,
          magicMcpServerOid: 50n
        }
      },
      data: {
        instanceOid: 10n,
        consumerOid: 20n,
        isManaged: undefined
      },
      include: expect.any(Object)
    });
  });

  it('links auth attempts to an upserted consumer integration endpoint', async () => {
    (db.consumerIntegrationEndpoint.upsert as any).mockResolvedValue({
      oid: 99n,
      id: 'consumerIntegrationEndpoint-1'
    } as any);

    await consumerIntegrationService.linkConsumerAuthAttemptToConsumerIntegrationEndpoint({
      consumerAuthAttempt: {
        oid: 72n
      },
      consumerProfile: {
        oid: 30n,
        instanceOid: 10n,
        consumerOid: 20n
      },
      magicMcpEndpoint: {
        oid: 40n,
        instanceOid: 10n
      },
      isManaged: true
    });

    expect(db.consumerAuthAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        oid: 72n
      },
      data: {
        consumerIntegrationEndpointOid: 99n
      }
    });
  });
});
