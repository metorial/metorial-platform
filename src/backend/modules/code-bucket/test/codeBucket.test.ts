import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { CodeBucket, CodeBucketTemplate, Instance, ScmRepo } from '@metorial/db';

// Mock all external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    codeBucket: {
      create: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    scmRepo: {
      findFirstOrThrow: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  }
}));

vi.mock('@metorial/delay', () => ({
  delay: vi.fn()
}));

vi.mock('@metorial/error', () => ({
  badRequestError: vi.fn((msg) => msg),
  ServiceError: class ServiceError extends Error {
    constructor(error: any) {
      super(error.message);
    }
  }
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('../src/lib/codeWorkspace', () => ({
  codeWorkspaceClient: {
    getBucketFilesWithContent: vi.fn(),
    getBucketToken: vi.fn(),
    cloneBucket: vi.fn(),
    createBucketFromGithub: vi.fn()
  }
}));

vi.mock('../src/queue/cloneBucket', () => ({
  cloneBucketQueue: {
    add: vi.fn()
  },
  cloneBucketQueueProcessor: {}
}));

vi.mock('../src/queue/importGithub', () => ({
  importGithubQueue: {
    add: vi.fn()
  },
  importGithubQueueProcessor: {}
}));

vi.mock('../src/queue/exportGithub', () => ({
  exportGithubQueue: {
    add: vi.fn()
  },
  exportGithubQueueProcessor: {}
}));

vi.mock('../src/queue/importTemplate', () => ({
  importTemplateQueue: {
    add: vi.fn()
  },
  importTemplateQueueProcessor: {}
}));

vi.mock('../src/queue/copyFromToBucket', () => ({
  copyFromToBucketQueue: {
    add: vi.fn()
  },
  copyFromToBucketQueueProcessor: {}
}));

// Import after mocking
import { db, ID } from '@metorial/db';
import { delay } from '@metorial/delay';
import { ServiceError } from '@metorial/error';
import { codeWorkspaceClient } from '../src/lib/codeWorkspace';
import { cloneBucketQueue } from '../src/queue/cloneBucket';
import { importGithubQueue } from '../src/queue/importGithub';
import { exportGithubQueue } from '../src/queue/exportGithub';
import { importTemplateQueue } from '../src/queue/importTemplate';
import { copyFromToBucketQueue } from '../src/queue/copyFromToBucket';
import { codeBucketService } from '../src/services/codeBucket';

describe('codeBucketService', () => {
  const mockInstance: Instance = {
    id: 'inst_123',
    oid: 1n,
    name: 'Test Instance',
    slug: 'test-instance'
  } as any;

  const mockRepo: ScmRepo = {
    id: 'repo_123',
    oid: 1n,
    provider: 'github',
    externalOwner: 'testowner',
    externalName: 'testrepo',
    defaultBranch: 'main'
  } as any;

  const mockCodeBucket: CodeBucket = {
    id: 'bucket_123',
    oid: 1n,
    instanceOid: mockInstance.oid,
    purpose: 'custom_server',
    status: 'ready',
    isReadOnly: false
  } as any;

  const mockTemplate: CodeBucketTemplate = {
    id: 'template_123',
    oid: 1n,
    name: 'Test Template',
    providerBucketOid: null
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ID.generateId).mockResolvedValue('bucket_new_123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createCodeBucket', () => {
    it('should create a basic code bucket', async () => {
      const expectedBucket = {
        ...mockCodeBucket,
        id: 'bucket_new_123'
      };

      vi.mocked(db.codeBucket.create).mockResolvedValue(expectedBucket);

      const result = await codeBucketService.createCodeBucket({
        instance: mockInstance,
        purpose: 'custom_server'
      });

      expect(ID.generateId).toHaveBeenCalledWith('codeBucket');
      expect(db.codeBucket.create).toHaveBeenCalledWith({
        data: {
          id: 'bucket_new_123',
          instanceOid: mockInstance.oid,
          purpose: 'custom_server',
          isReadOnly: undefined
        },
        include: { repository: true }
      });
      expect(result).toEqual(expectedBucket);
    });

    it('should create a read-only code bucket', async () => {
      const expectedBucket = {
        ...mockCodeBucket,
        id: 'bucket_new_123',
        isReadOnly: true
      };

      vi.mocked(db.codeBucket.create).mockResolvedValue(expectedBucket);

      await codeBucketService.createCodeBucket({
        instance: mockInstance,
        purpose: 'custom_server',
        isReadOnly: true
      });

      expect(db.codeBucket.create).toHaveBeenCalledWith({
        data: {
          id: 'bucket_new_123',
          instanceOid: mockInstance.oid,
          purpose: 'custom_server',
          isReadOnly: true
        },
        include: { repository: true }
      });
    });
  });

  describe('createCodeBucketFromRepo', () => {
    it('should create a code bucket from a GitHub repository', async () => {
      const expectedBucket = {
        ...mockCodeBucket,
        id: 'bucket_new_123',
        status: 'importing' as const,
        repositoryOid: mockRepo.oid,
        path: '/'
      };

      vi.mocked(db.codeBucket.create).mockResolvedValue(expectedBucket);

      const result = await codeBucketService.createCodeBucketFromRepo({
        instance: mockInstance,
        purpose: 'custom_server',
        repo: mockRepo
      });

      expect(db.codeBucket.create).toHaveBeenCalledWith({
        data: {
          id: 'bucket_new_123',
          instanceOid: mockInstance.oid,
          purpose: 'custom_server',
          repositoryOid: mockRepo.oid,
          path: '/',
          status: 'importing' as const,
          isReadOnly: undefined
        },
        include: { repository: true }
      });

      expect(importGithubQueue.add).toHaveBeenCalledWith({
        newBucketId: 'bucket_new_123',
        owner: 'testowner',
        repo: 'testrepo',
        ref: 'main',
        path: '/',
        repoId: mockRepo.id
      });

      expect(result).toEqual(expectedBucket);
    });

    it('should normalize path when creating from repo', async () => {
      const expectedBucket = {
        ...mockCodeBucket,
        id: 'bucket_new_123',
        status: 'importing' as const,
        path: '/src/components'
      };

      vi.mocked(db.codeBucket.create).mockResolvedValue(expectedBucket);

      await codeBucketService.createCodeBucketFromRepo({
        instance: mockInstance,
        purpose: 'custom_server',
        repo: mockRepo,
        path: '/src//components/./'
      });

      expect(db.codeBucket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            path: '/src/components'
          })
        })
      );
    });

    it('should use custom ref when provided', async () => {
      const expectedBucket = {
        ...mockCodeBucket,
        id: 'bucket_new_123',
        status: 'importing' as const
      };

      vi.mocked(db.codeBucket.create).mockResolvedValue(expectedBucket);

      await codeBucketService.createCodeBucketFromRepo({
        instance: mockInstance,
        purpose: 'custom_server',
        repo: mockRepo,
        ref: 'develop'
      });

      expect(importGithubQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: 'develop'
        })
      );
    });

    it('should throw error for non-GitHub repositories', async () => {
      const nonGitHubRepo = {
        ...mockRepo,
        provider: 'gitlab'
      };

      await expect(
        codeBucketService.createCodeBucketFromRepo({
          instance: mockInstance,
          purpose: 'custom_server',
          repo: nonGitHubRepo as any
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('cloneCodeBucketTemplate', () => {
    it('should clone a template with provider bucket', async () => {
      const templateWithProvider: CodeBucketTemplate = {
        ...mockTemplate,
        providerBucketOid: 5n
      };

      const providerBucket = {
        id: 'provider_bucket_123',
        oid: 5n
      };

      const expectedBucket = {
        ...mockCodeBucket,
        id: 'bucket_new_123',
        status: 'importing' as const,
        templateOid: templateWithProvider.oid
      };

      vi.mocked(db.codeBucket.create).mockResolvedValue(expectedBucket);
      vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(providerBucket as any);

      const result = await codeBucketService.cloneCodeBucketTemplate({
        instance: mockInstance,
        purpose: 'custom_server',
        template: templateWithProvider
      });

      expect(db.codeBucket.create).toHaveBeenCalledWith({
        data: {
          id: 'bucket_new_123',
          instanceOid: mockInstance.oid,
          purpose: 'custom_server',
          templateOid: templateWithProvider.oid,
          isReadOnly: undefined,
          status: 'importing'
        },
        include: { repository: true }
      });

      expect(copyFromToBucketQueue.add).toHaveBeenCalledWith({
        sourceBucketId: 'provider_bucket_123',
        targetBucketId: 'bucket_new_123'
      });

      expect(importTemplateQueue.add).not.toHaveBeenCalled();
      expect(result).toEqual(expectedBucket);
    });

    it('should clone a template without provider bucket', async () => {
      const expectedBucket = {
        ...mockCodeBucket,
        id: 'bucket_new_123',
        status: 'importing' as const,
        templateOid: mockTemplate.oid
      };

      vi.mocked(db.codeBucket.create).mockResolvedValue(expectedBucket);

      await codeBucketService.cloneCodeBucketTemplate({
        instance: mockInstance,
        purpose: 'custom_server',
        template: mockTemplate
      });

      expect(importTemplateQueue.add).toHaveBeenCalledWith({
        bucketId: 'bucket_new_123',
        templateId: mockTemplate.id
      });

      expect(copyFromToBucketQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('waitForCodeBucketReady', () => {
    it('should wait until bucket status is ready', async () => {
      const importingBucket = { ...mockCodeBucket, status: 'importing' as const };
      const readyBucket = { ...mockCodeBucket, status: 'ready' as const };

      vi.mocked(db.codeBucket.findFirstOrThrow)
        .mockResolvedValueOnce(importingBucket as any)
        .mockResolvedValueOnce(importingBucket as any)
        .mockResolvedValueOnce(readyBucket as any);

      vi.mocked(delay).mockResolvedValue(undefined);

      await codeBucketService.waitForCodeBucketReady({
        codeBucketId: 'bucket_123'
      });

      expect(db.codeBucket.findFirstOrThrow).toHaveBeenCalledTimes(3);
      expect(delay).toHaveBeenCalledTimes(2);
      expect(delay).toHaveBeenCalledWith(1000);
    });

    it('should return immediately if bucket is already ready', async () => {
      const readyBucket = { ...mockCodeBucket, status: 'ready' as const };

      vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(readyBucket as any);

      await codeBucketService.waitForCodeBucketReady({
        codeBucketId: 'bucket_123'
      });

      expect(db.codeBucket.findFirstOrThrow).toHaveBeenCalledTimes(1);
      expect(delay).not.toHaveBeenCalled();
    });
  });

  describe('cloneCodeBucket', () => {
    it('should clone an existing code bucket', async () => {
      const expectedBucket = {
        ...mockCodeBucket,
        id: 'bucket_new_123',
        parentOid: mockCodeBucket.oid,
        status: 'importing' as const
      };

      vi.mocked(db.codeBucket.create).mockResolvedValue(expectedBucket);

      const result = await codeBucketService.cloneCodeBucket({
        codeBucket: mockCodeBucket
      });

      expect(db.codeBucket.create).toHaveBeenCalledWith({
        data: {
          id: 'bucket_new_123',
          instanceOid: mockCodeBucket.instanceOid,
          purpose: mockCodeBucket.purpose,
          parentOid: mockCodeBucket.oid,
          isReadOnly: undefined,
          status: 'importing'
        },
        include: { repository: true }
      });

      expect(cloneBucketQueue.add).toHaveBeenCalledWith({
        bucketId: 'bucket_new_123'
      });

      expect(result).toEqual(expectedBucket);
    });

    it('should clone with read-only flag', async () => {
      const expectedBucket = {
        ...mockCodeBucket,
        id: 'bucket_new_123',
        isReadOnly: true
      };

      vi.mocked(db.codeBucket.create).mockResolvedValue(expectedBucket);

      await codeBucketService.cloneCodeBucket({
        codeBucket: mockCodeBucket,
        isReadOnly: true
      });

      expect(db.codeBucket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isReadOnly: true
          })
        })
      );
    });
  });

  describe('exportCodeBucketToGithub', () => {
    it('should export code bucket to GitHub repository', async () => {
      await codeBucketService.exportCodeBucketToGithub({
        codeBucket: mockCodeBucket,
        repo: mockRepo,
        path: '/exported'
      });

      expect(exportGithubQueue.add).toHaveBeenCalledWith({
        bucketId: mockCodeBucket.id,
        repoId: mockRepo.id,
        path: '/exported'
      });
    });

    it('should throw error for non-GitHub repositories', async () => {
      const nonGitHubRepo = {
        ...mockRepo,
        provider: 'gitlab'
      };

      await expect(
        codeBucketService.exportCodeBucketToGithub({
          codeBucket: mockCodeBucket,
          repo: nonGitHubRepo as any,
          path: '/exported'
        })
      ).rejects.toThrow(ServiceError);

      expect(exportGithubQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('getCodeBucketFilesWithContent', () => {
    it('should get files with content after bucket is ready', async () => {
      const readyBucket = { ...mockCodeBucket, status: 'ready' as const };
      vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(readyBucket as any);

      const mockFiles = [
        {
          fileInfo: { path: '/file1.ts', size: 100 },
          content: 'content1'
        },
        {
          fileInfo: { path: '/file2.ts', size: 200 },
          content: 'content2'
        }
      ];

      vi.mocked(codeWorkspaceClient.getBucketFilesWithContent).mockResolvedValue({
        files: mockFiles
      } as any);

      const result = await codeBucketService.getCodeBucketFilesWithContent({
        codeBucket: mockCodeBucket
      });

      expect(codeWorkspaceClient.getBucketFilesWithContent).toHaveBeenCalledWith({
        bucketId: mockCodeBucket.id,
        prefix: ''
      });

      expect(result).toEqual([
        { path: '/file1.ts', size: 100, content: 'content1' },
        { path: '/file2.ts', size: 200, content: 'content2' }
      ]);
    });

    it('should get files with custom prefix', async () => {
      const readyBucket = { ...mockCodeBucket, status: 'ready' as const };
      vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(readyBucket as any);

      vi.mocked(codeWorkspaceClient.getBucketFilesWithContent).mockResolvedValue({
        files: []
      } as any);

      await codeBucketService.getCodeBucketFilesWithContent({
        codeBucket: mockCodeBucket,
        prefix: '/src'
      });

      expect(codeWorkspaceClient.getBucketFilesWithContent).toHaveBeenCalledWith({
        bucketId: mockCodeBucket.id,
        prefix: '/src'
      });
    });
  });

  describe('getEditorToken', () => {
    it('should get editor token for ready bucket', async () => {
      const readyBucket = { ...mockCodeBucket, status: 'ready' as const };
      vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(readyBucket as any);

      vi.mocked(codeWorkspaceClient.getBucketToken).mockResolvedValue({
        token: 'test_token_123'
      } as any);

      const now = Date.now();
      const result = await codeBucketService.getEditorToken({
        codeBucket: mockCodeBucket
      });

      expect(codeWorkspaceClient.getBucketToken).toHaveBeenCalledWith({
        bucketId: mockCodeBucket.id,
        isReadOnly: mockCodeBucket.isReadOnly,
        expiresInSeconds: expect.any(Object) // Long object
      });

      expect(result.id).toBe(mockCodeBucket.id);
      expect(result.token).toBe('test_token_123');
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(now);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(now + 60 * 60 * 24 * 7 * 1000);
    });

    it('should pass read-only flag to token generation', async () => {
      const readOnlyBucket = { ...mockCodeBucket, isReadOnly: true, status: 'ready' as const };
      vi.mocked(db.codeBucket.findFirstOrThrow).mockResolvedValue(readOnlyBucket as any);

      vi.mocked(codeWorkspaceClient.getBucketToken).mockResolvedValue({
        token: 'readonly_token_123'
      } as any);

      await codeBucketService.getEditorToken({
        codeBucket: readOnlyBucket
      });

      expect(codeWorkspaceClient.getBucketToken).toHaveBeenCalledWith(
        expect.objectContaining({
          isReadOnly: true
        })
      );
    });
  });

  describe('syncCodeBuckets', () => {
    it('should sync from source to target bucket', async () => {
      const sourceBucket = { ...mockCodeBucket, id: 'source_123' };
      const targetBucket = {
        ...mockCodeBucket,
        id: 'target_123',
        oid: 2n
      };

      vi.mocked(db.codeBucket.update).mockResolvedValue(targetBucket as any);

      await codeBucketService.syncCodeBuckets({
        source: sourceBucket,
        target: targetBucket
      });

      expect(db.codeBucket.update).toHaveBeenCalledWith({
        where: { oid: targetBucket.oid },
        data: { status: 'importing' }
      });

      expect(copyFromToBucketQueue.add).toHaveBeenCalledWith({
        sourceBucketId: 'source_123',
        targetBucketId: 'target_123'
      });
    });
  });
});
