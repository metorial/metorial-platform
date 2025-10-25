// @ts-nocheck - Test file with mocked types
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueRetryError } from '@metorial/queue';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    scmRepo: {
      findUnique: vi.fn()
    },
    scmRepoWebhook: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  }
}));

vi.mock('@metorial/config', () => ({
  getFullConfig: vi.fn(),
  getConfig: vi.fn(() => ({
    redisUrl: 'redis://localhost:6379'
  }))
}));

vi.mock('@metorial/id', () => ({
  generatePlainId: vi.fn()
}));

vi.mock('@octokit/core', () => ({
  Octokit: vi.fn()
}));

// Mock queue creation to avoid Redis connection
vi.mock('@metorial/queue', () => {
  let handler: any = null;
  return {
    QueueRetryError: class QueueRetryError extends Error {},
    createQueue: vi.fn(() => ({
      process: vi.fn((fn) => {
        handler = fn;
        return { handler: fn };
      }),
      add: vi.fn()
    }))
  };
});

import { db, ID } from '@metorial/db';
import { getFullConfig } from '@metorial/config';
import { generatePlainId } from '@metorial/id';
import { Octokit } from '@octokit/core';
import {
  createRepoWebhookQueue,
  createRepoWebhookQueueProcessor
} from '../src/queue/createRepoWebhook';

describe('createRepoWebhookQueueProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create webhook for repository', async () => {
    const mockRepo = {
      id: 'scm-repo-1',
      oid: 'repo-oid-1',
      externalOwner: 'testuser',
      externalName: 'test-repo',
      installation: {
        accessToken: 'test-token'
      }
    };

    const mockWebhookResponse = {
      data: {
        id: 999,
        config: { url: 'https://example.com/webhook' }
      }
    };

    vi.mocked(db.scmRepo.findUnique).mockResolvedValue(mockRepo as any);
    vi.mocked(db.scmRepoWebhook.findUnique).mockResolvedValue(null); // No existing webhook
    vi.mocked(generatePlainId).mockReturnValue('secret-123');
    vi.mocked(ID.generateId).mockResolvedValue('webhook-1');
    vi.mocked(getFullConfig).mockResolvedValue({
      urls: { integrationsApiUrl: 'https://integrations.example.com' }
    } as any);

    const mockRequest = vi.fn().mockResolvedValue(mockWebhookResponse);
    vi.mocked(Octokit).mockImplementation(
      () =>
        ({
          request: mockRequest
        }) as any
    );

    vi.mocked(db.scmRepoWebhook.upsert).mockResolvedValue({
      id: 'webhook-1',
      repoOid: mockRepo.oid
    } as any);

    await createRepoWebhookQueueProcessor.handler({ repoId: 'scm-repo-1' });

    expect(db.scmRepo.findUnique).toHaveBeenCalledWith({
      where: { id: 'scm-repo-1' },
      include: { installation: true }
    });

    expect(mockRequest).toHaveBeenCalledWith('POST /repos/{owner}/{repo}/hooks', {
      owner: 'testuser',
      repo: 'test-repo',
      config: {
        url: 'https://integrations.example.com/integrations/scm/webhook-ingest/gh/webhook-1',
        content_type: 'json',
        secret: 'secret-123',
        insecure_ssl: '0'
      },
      events: ['push'],
      active: true
    });

    expect(db.scmRepoWebhook.upsert).toHaveBeenCalledWith({
      where: { repoOid: mockRepo.oid },
      create: {
        id: 'webhook-1',
        repoOid: mockRepo.oid,
        externalId: '999',
        signingSecret: 'secret-123',
        type: 'push'
      },
      update: {}
    });
  });

  it('should throw QueueRetryError when repo not found', async () => {
    vi.mocked(db.scmRepo.findUnique).mockResolvedValue(null);

    await expect(
      createRepoWebhookQueueProcessor.handler({ repoId: 'non-existent' })
    ).rejects.toThrow(QueueRetryError);
  });

  it('should skip creation if webhook already exists', async () => {
    const mockRepo = {
      id: 'scm-repo-1',
      oid: 'repo-oid-1',
      externalOwner: 'testuser',
      externalName: 'test-repo',
      installation: {
        accessToken: 'test-token'
      }
    };

    const mockExistingWebhook = {
      id: 'existing-webhook',
      repoOid: mockRepo.oid
    };

    vi.mocked(db.scmRepo.findUnique).mockResolvedValue(mockRepo as any);
    vi.mocked(db.scmRepoWebhook.findUnique).mockResolvedValue(mockExistingWebhook as any);

    const mockRequest = vi.fn();
    vi.mocked(Octokit).mockImplementation(
      () =>
        ({
          request: mockRequest
        }) as any
    );

    await createRepoWebhookQueueProcessor.handler({ repoId: 'scm-repo-1' });

    expect(mockRequest).not.toHaveBeenCalled();
    expect(db.scmRepoWebhook.upsert).not.toHaveBeenCalled();
  });

  it('should generate unique webhook ID and secret', async () => {
    const mockRepo = {
      id: 'scm-repo-1',
      oid: 'repo-oid-1',
      externalOwner: 'testuser',
      externalName: 'test-repo',
      installation: {
        accessToken: 'test-token'
      }
    };

    vi.mocked(db.scmRepo.findUnique).mockResolvedValue(mockRepo as any);
    vi.mocked(db.scmRepoWebhook.findUnique).mockResolvedValue(null);
    vi.mocked(generatePlainId).mockReturnValue('unique-secret-456');
    vi.mocked(ID.generateId).mockResolvedValue('unique-webhook-id-789');
    vi.mocked(getFullConfig).mockResolvedValue({
      urls: { integrationsApiUrl: 'https://integrations.example.com' }
    } as any);

    const mockRequest = vi.fn().mockResolvedValue({
      data: { id: 123 }
    });
    vi.mocked(Octokit).mockImplementation(
      () =>
        ({
          request: mockRequest
        }) as any
    );

    vi.mocked(db.scmRepoWebhook.upsert).mockResolvedValue({} as any);

    await createRepoWebhookQueueProcessor.handler({ repoId: 'scm-repo-1' });

    expect(generatePlainId).toHaveBeenCalledWith(32);
    expect(ID.generateId).toHaveBeenCalledWith('scmRepoWebhook');

    expect(mockRequest).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/hooks',
      expect.objectContaining({
        config: expect.objectContaining({
          url: 'https://integrations.example.com/integrations/scm/webhook-ingest/gh/unique-webhook-id-789',
          secret: 'unique-secret-456'
        })
      })
    );
  });

  it('should handle GitHub API errors gracefully', async () => {
    const mockRepo = {
      id: 'scm-repo-1',
      oid: 'repo-oid-1',
      externalOwner: 'testuser',
      externalName: 'test-repo',
      installation: {
        accessToken: 'invalid-token'
      }
    };

    vi.mocked(db.scmRepo.findUnique).mockResolvedValue(mockRepo as any);
    vi.mocked(db.scmRepoWebhook.findUnique).mockResolvedValue(null);
    vi.mocked(generatePlainId).mockReturnValue('secret');
    vi.mocked(ID.generateId).mockResolvedValue('webhook-1');
    vi.mocked(getFullConfig).mockResolvedValue({
      urls: { integrationsApiUrl: 'https://integrations.example.com' }
    } as any);

    const mockRequest = vi.fn().mockRejectedValue(new Error('GitHub API Error: Unauthorized'));
    vi.mocked(Octokit).mockImplementation(
      () =>
        ({
          request: mockRequest
        }) as any
    );

    await expect(
      createRepoWebhookQueueProcessor.handler({ repoId: 'scm-repo-1' })
    ).rejects.toThrow('GitHub API Error: Unauthorized');
  });

  it('should use correct webhook configuration', async () => {
    const mockRepo = {
      id: 'scm-repo-1',
      oid: 'repo-oid-1',
      externalOwner: 'testuser',
      externalName: 'test-repo',
      installation: {
        accessToken: 'test-token'
      }
    };

    vi.mocked(db.scmRepo.findUnique).mockResolvedValue(mockRepo as any);
    vi.mocked(db.scmRepoWebhook.findUnique).mockResolvedValue(null);
    vi.mocked(generatePlainId).mockReturnValue('secret');
    vi.mocked(ID.generateId).mockResolvedValue('webhook-1');
    vi.mocked(getFullConfig).mockResolvedValue({
      urls: { integrationsApiUrl: 'https://integrations.example.com' }
    } as any);

    const mockRequest = vi.fn().mockResolvedValue({
      data: { id: 123 }
    });
    vi.mocked(Octokit).mockImplementation(
      () =>
        ({
          request: mockRequest
        }) as any
    );

    vi.mocked(db.scmRepoWebhook.upsert).mockResolvedValue({} as any);

    await createRepoWebhookQueueProcessor.handler({ repoId: 'scm-repo-1' });

    expect(mockRequest).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/hooks',
      expect.objectContaining({
        config: {
          url: expect.any(String),
          content_type: 'json',
          secret: 'secret',
          insecure_ssl: '0'
        },
        events: ['push'],
        active: true
      })
    );
  });
});

describe('createRepoWebhookQueue', () => {
  it('should be a valid queue', () => {
    expect(createRepoWebhookQueue).toBeDefined();
    expect(createRepoWebhookQueue.add).toBeInstanceOf(Function);
  });
});
