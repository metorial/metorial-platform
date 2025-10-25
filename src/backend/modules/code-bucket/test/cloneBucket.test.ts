import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock all external dependencies before importing
vi.mock('@metorial/db', () => ({
  db: {
    codeBucket: {
      findFirstOrThrow: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config) => ({
    process: (fn: any) => fn,
    add: vi.fn()
  }))
}));

vi.mock('../src/lib/codeWorkspace', () => ({
  codeWorkspaceClient: {
    cloneBucket: vi.fn()
  }
}));

vi.mock('../src/services', () => ({
  codeBucketService: {
    waitForCodeBucketReady: vi.fn()
  }
}));

// Import after mocking
import { db } from '@metorial/db';
import { codeWorkspaceClient } from '../src/lib/codeWorkspace';
import { codeBucketService } from '../src/services';
import { cloneBucketQueueProcessor } from '../src/queue/cloneBucket';

// Type helper for queue processor
const processor = cloneBucketQueueProcessor as unknown as (data: {
  bucketId: string;
}) => Promise<void>;

describe('cloneBucket queue processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should clone a bucket with valid parent', async () => {
    const mockParentBucket = {
      id: 'parent_bucket_123',
      oid: 1n,
      status: 'ready'
    };

    const mockBucket = {
      id: 'new_bucket_123',
      oid: 2n,
      status: 'importing',
      parent: mockParentBucket,
      parentOid: mockParentBucket.oid
    };

    vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(mockBucket as any);
    vi.mocked(codeBucketService.waitForCodeBucketReady).mockResolvedValue(undefined);
    vi.mocked(codeWorkspaceClient.cloneBucket).mockResolvedValue({} as any);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor({
      bucketId: 'new_bucket_123'
    });

    expect(db.codeBucket.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'new_bucket_123' },
      include: { parent: true }
    });

    expect(codeBucketService.waitForCodeBucketReady).toHaveBeenCalledWith({
      codeBucketId: 'parent_bucket_123'
    });

    expect(codeWorkspaceClient.cloneBucket).toHaveBeenCalledWith({
      sourceBucketId: 'parent_bucket_123',
      newBucketId: 'new_bucket_123'
    });

    expect(db.codeBucket.updateMany).toHaveBeenCalledWith({
      where: { id: 'new_bucket_123' },
      data: { status: 'ready' }
    });
  });

  it('should return early if bucket has no parent', async () => {
    const mockBucket = {
      id: 'new_bucket_123',
      oid: 2n,
      status: 'importing',
      parent: null,
      parentOid: null
    };

    vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(mockBucket as any);

    await processor({
      bucketId: 'new_bucket_123'
    });

    expect(db.codeBucket.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'new_bucket_123' },
      include: { parent: true }
    });

    expect(codeBucketService.waitForCodeBucketReady).not.toHaveBeenCalled();
    expect(codeWorkspaceClient.cloneBucket).not.toHaveBeenCalled();
    expect(db.codeBucket.updateMany).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const mockBucket = {
      id: 'new_bucket_123',
      oid: 2n,
      status: 'importing',
      parent: {
        id: 'parent_bucket_123',
        oid: 1n
      }
    };

    vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(mockBucket as any);
    vi.mocked(codeBucketService.waitForCodeBucketReady).mockResolvedValue(undefined);
    vi.mocked(codeWorkspaceClient.cloneBucket).mockRejectedValue(
      new Error('Clone failed')
    );

    await expect(
      processor({
        bucketId: 'new_bucket_123'
      })
    ).rejects.toThrow('Clone failed');

    expect(db.codeBucket.updateMany).not.toHaveBeenCalled();
  });

  it('should wait for parent bucket to be ready before cloning', async () => {
    const mockParentBucket = {
      id: 'parent_bucket_123',
      oid: 1n,
      status: 'importing'
    };

    const mockBucket = {
      id: 'new_bucket_123',
      oid: 2n,
      status: 'importing',
      parent: mockParentBucket
    };

    vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(mockBucket as any);
    vi.mocked(codeBucketService.waitForCodeBucketReady).mockResolvedValue(undefined);
    vi.mocked(codeWorkspaceClient.cloneBucket).mockResolvedValue({} as any);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor({
      bucketId: 'new_bucket_123'
    });

    // Verify waitForCodeBucketReady was called before cloneBucket
    expect(codeBucketService.waitForCodeBucketReady).toHaveBeenCalled();
    const waitCallOrder = vi.mocked(codeBucketService.waitForCodeBucketReady).mock.invocationCallOrder[0];
    const cloneCallOrder = vi.mocked(codeWorkspaceClient.cloneBucket).mock.invocationCallOrder[0];
    expect(waitCallOrder).toBeLessThan(cloneCallOrder);
  });

  it('should handle bucket not found error', async () => {
    vi.mocked(db.codeBucket.findFirstOrThrow).mockRejectedValue(
      new Error('Bucket not found')
    );

    await expect(
      processor({
        bucketId: 'nonexistent_bucket'
      })
    ).rejects.toThrow('Bucket not found');

    expect(codeBucketService.waitForCodeBucketReady).not.toHaveBeenCalled();
    expect(codeWorkspaceClient.cloneBucket).not.toHaveBeenCalled();
  });

  it('should update bucket status to ready after successful clone', async () => {
    const mockBucket = {
      id: 'new_bucket_123',
      oid: 2n,
      status: 'importing',
      parent: {
        id: 'parent_bucket_123',
        oid: 1n
      }
    };

    vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(mockBucket as any);
    vi.mocked(codeBucketService.waitForCodeBucketReady).mockResolvedValue(undefined);
    vi.mocked(codeWorkspaceClient.cloneBucket).mockResolvedValue({} as any);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor({
      bucketId: 'new_bucket_123'
    });

    // Verify status was updated after clone
    expect(db.codeBucket.updateMany).toHaveBeenCalled();
    const updateCallOrder = vi.mocked(db.codeBucket.updateMany).mock.invocationCallOrder[0];
    const cloneCallOrder = vi.mocked(codeWorkspaceClient.cloneBucket).mock.invocationCallOrder[0];
    expect(updateCallOrder).toBeGreaterThan(cloneCallOrder);

    expect(db.codeBucket.updateMany).toHaveBeenCalledWith({
      where: { id: 'new_bucket_123' },
      data: { status: 'ready' }
    });
  });
});
