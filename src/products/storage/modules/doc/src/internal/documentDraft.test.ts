import { beforeEach, describe, expect, it, vi } from 'vitest';

let { createLock, usingLock, createRedisClient } = vi.hoisted(() => {
  let usingLock = vi.fn(
    async (_key: string, fn: (controller: { passForNow: () => void }) => Promise<any>) =>
      await fn({ passForNow: () => {} })
  );

  return {
    usingLock,
    createLock: vi.fn(() => ({
      usingLock
    })),
    createRedisClient: vi.fn(() => ({
      eager: vi.fn(async () => ({
        scriptLoad: vi.fn(async () => 'script-sha')
      }))
    }))
  };
});

vi.mock('@lowerdeck/lock', () => ({
  createLock
}));

vi.mock('@lowerdeck/redis', () => ({
  createRedisClient
}));

vi.mock('@metorial/config', () => ({
  getConfig: vi.fn(() => ({
    redisUrl: 'redis://localhost:6379'
  }))
}));

import { internalDocumentDraftService } from './documentDraft';

describe('document lock', () => {
  beforeEach(() => {
    usingLock.mockClear();
  });

  it('uses the shared lock namespace and document ID', async () => {
    let result = await internalDocumentDraftService.withDocumentLock(
      'doc_1',
      async () => 'ok'
    );

    expect(createLock).toHaveBeenCalledWith({
      name: 'cargo/doc/document',
      redisUrl: 'redis://localhost:6379'
    });
    expect(usingLock).toHaveBeenCalledWith('doc_1', expect.any(Function));
    expect(result).toBe('ok');
  });

  it('preserves callback errors', async () => {
    let error = new Error('failed');

    await expect(
      internalDocumentDraftService.withDocumentLock('doc_1', async () => {
        throw error;
      })
    ).rejects.toBe(error);
  });
});
