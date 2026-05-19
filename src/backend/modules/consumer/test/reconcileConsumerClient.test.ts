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

vi.mock('@metorial/db', () => ({
  db: {
    consumerAuthClient: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn()
    }
  }
}));

vi.mock('../src/services/consumerOAuth', () => ({
  consumerOAuthClientService: {
    linkConsumerAuthClientToConsumerClient: vi.fn()
  }
}));

import { db } from '@metorial/db';
import {
  reconcileConsumerClientManyQueue,
  reconcileConsumerClientManyQueueProcessor,
  reconcileConsumerClientSingleQueueProcessor
} from '../src/queues/reconcileConsumerClient';
import { consumerOAuthClientService } from '../src/services/consumerOAuth';

describe('reconcileConsumerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fans out auth clients missing consumer clients', async () => {
    vi.mocked(db.consumerAuthClient.findMany).mockResolvedValue([
      {
        id: 'client-1'
      },
      {
        id: 'client-2'
      }
    ] as any);

    await (reconcileConsumerClientManyQueueProcessor as any).handler({});

    expect(reconcileConsumerClientManyQueue.add).toHaveBeenCalledWith({
      cursor: 'client-2'
    });
  });

  it('links one auth client to its consumer client in the single processor', async () => {
    vi.mocked(db.consumerAuthClient.findUnique).mockResolvedValue({
      oid: 10n,
      consumerSurfaceOid: 11n,
      name: 'CLI',
      redirectUris: ['https://example.com/callback']
    } as any);
    vi.mocked(db.consumerAuthClient.findUniqueOrThrow).mockResolvedValue({
      oid: 10n,
      consumerAuthClientSurfaces: [],
      name: 'CLI',
      redirectUris: ['https://example.com/callback']
    } as any);

    await (reconcileConsumerClientSingleQueueProcessor as any).handler({
      consumerAuthClientId: 'client-1'
    });

    expect(
      consumerOAuthClientService.linkConsumerAuthClientToConsumerClient
    ).toHaveBeenCalledWith({
      consumerAuthClient: {
        oid: 10n,
        consumerAuthClientSurfaces: [],
        name: 'CLI',
        redirectUris: ['https://example.com/callback']
      }
    });
  });
});
