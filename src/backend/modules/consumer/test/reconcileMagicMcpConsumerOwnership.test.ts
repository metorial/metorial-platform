import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({
    config,
    handler
  }))
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => ({
      handler
    }))
  })),
  combineQueueProcessors: vi.fn(processors => processors)
}));

vi.mock('@metorial/db', () => {
  let db = {
    magicMcpToken: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    consumerAuthAttempt: {
      findMany: vi.fn()
    },
    consumerProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    magicMcpServer: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    magicMcpEndpoint: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    magicMcpSession: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    consumerToken: {
      findMany: vi.fn()
    }
  };

  return { db };
});

vi.mock('../src/services/consumerEntities/consumerIntegration', () => ({
  consumerIntegrationService: {
    upsertConsumerToken: vi.fn(),
    upsertConsumerIntegration: vi.fn(),
    upsertConsumerIntegrationEndpoint: vi.fn(),
    linkConsumerAuthAttemptToConsumerIntegrationEndpoint: vi.fn(),
    upsertConsumerIntegrationSession: vi.fn(),
    materializeMagicMcpSessionOwnership: vi.fn(),
    markMagicMcpResourcesConsumerReconciled: vi.fn()
  }
}));

import { db } from '@metorial/db';
import { reconcileMagicMcpConsumerOwnershipSingleQueueProcessor } from '../src/queues/reconcileMagicMcpConsumerOwnership';
import { consumerIntegrationService } from '../src/services/consumerEntities/consumerIntegration';

describe('reconcileMagicMcpConsumerOwnership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('backfills a consumer token when the auth attempt has one clear owner', async () => {
    vi.mocked(db.magicMcpToken.findUnique).mockResolvedValue({
      oid: 10n,
      instanceOid: 1n
    } as any);
    vi.mocked(db.consumerAuthAttempt.findMany).mockResolvedValue([
      {
        consumerProfileOid: 22n
      }
    ] as any);
    vi.mocked(db.consumerProfile.findUnique).mockResolvedValue({
      oid: 22n,
      instanceOid: 1n,
      consumerOid: 33n
    } as any);

    await (reconcileMagicMcpConsumerOwnershipSingleQueueProcessor as any).handler({
      resourceType: 'token',
      resourceId: 'magic-token-1'
    });

    expect(consumerIntegrationService.upsertConsumerToken).toHaveBeenCalledWith({
      consumerProfile: {
        oid: 22n,
        instanceOid: 1n,
        consumerOid: 33n
      },
      magicMcpToken: {
        oid: 10n,
        instanceOid: 1n
      }
    });
    expect(
      consumerIntegrationService.markMagicMcpResourcesConsumerReconciled
    ).toHaveBeenCalledWith({
      magicMcpToken: {
        oid: 10n,
        instanceOid: 1n
      }
    });
  });

  it('marks an ambiguous legacy session as reconciled without inventing ownership', async () => {
    vi.mocked(db.magicMcpSession.findUnique).mockResolvedValue({
      oid: 70n,
      instanceOid: 1n,
      magicMcpServerOid: 50n,
      magicMcpEndpointOid: null,
      magicMcpServer: {
        oid: 50n,
        instanceOid: 1n
      },
      magicMcpEndpoint: null
    } as any);
    vi.mocked(db.consumerToken.findMany).mockResolvedValue([
      {
        consumerProfileOid: 22n
      },
      {
        consumerProfileOid: 23n
      }
    ] as any);

    await (reconcileMagicMcpConsumerOwnershipSingleQueueProcessor as any).handler({
      resourceType: 'session',
      resourceId: 'magic-session-1'
    });

    expect(consumerIntegrationService.upsertConsumerIntegration).not.toHaveBeenCalled();
    expect(
      consumerIntegrationService.materializeMagicMcpSessionOwnership
    ).not.toHaveBeenCalled();
    expect(
      consumerIntegrationService.markMagicMcpResourcesConsumerReconciled
    ).toHaveBeenCalledWith({
      magicMcpSession: expect.objectContaining({
        oid: 70n
      })
    });
  });

  it('backfills oauth attempt endpoint links during endpoint reconciliation', async () => {
    vi.mocked(db.magicMcpEndpoint.findUnique).mockResolvedValue({
      oid: 40n,
      instanceOid: 1n,
      consumerProfileOid: 22n
    } as any);
    vi.mocked(db.consumerProfile.findUnique).mockResolvedValue({
      oid: 22n,
      instanceOid: 1n,
      consumerOid: 33n
    } as any);
    vi.mocked(db.consumerAuthAttempt.findMany).mockResolvedValue([
      {
        oid: 60n,
        consumerProfile: {
          oid: 22n,
          instanceOid: 1n,
          consumerOid: 33n
        }
      }
    ] as any);

    await (reconcileMagicMcpConsumerOwnershipSingleQueueProcessor as any).handler({
      resourceType: 'endpoint',
      resourceId: 'magic-endpoint-1'
    });

    expect(
      consumerIntegrationService.linkConsumerAuthAttemptToConsumerIntegrationEndpoint
    ).toHaveBeenCalledWith({
      consumerAuthAttempt: {
        oid: 60n,
        consumerProfile: {
          oid: 22n,
          instanceOid: 1n,
          consumerOid: 33n
        }
      },
      consumerProfile: {
        oid: 22n,
        instanceOid: 1n,
        consumerOid: 33n
      },
      magicMcpEndpoint: {
        oid: 40n,
        instanceOid: 1n,
        consumerProfileOid: 22n
      },
      isManaged: false
    });
  });
});
