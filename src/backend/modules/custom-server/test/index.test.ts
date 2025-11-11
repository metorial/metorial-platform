import { describe, expect, it, vi } from 'vitest';

// Mock all the dependencies before importing
vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(() => ({
    process: vi.fn((fn) => ({
      type: 'queue',
      name: 'mockQueue',
      handler: fn
    }))
  })),
  QueueRetryError: class QueueRetryError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'QueueRetryError';
    }
  },
  combineQueueProcessors: vi.fn((processors) => ({
    combined: true,
    processors
  }))
}));

vi.mock('../src/cron/cleanup', () => ({
  customServerCleanupCron: { type: 'cron', name: 'cleanup' }
}));

vi.mock('../src/queues/checkRemote', () => ({
  checkRemoteQueueProcessor: { type: 'queue', name: 'checkRemote' }
}));

vi.mock('../src/queues/initializeLambda', () => ({
  initializeLambdaQueueProcessor: { type: 'queue', name: 'initializeLambda' }
}));

vi.mock('../src/queues/initializeRemote', () => ({
  initializeRemoteQueueProcessor: { type: 'queue', name: 'initializeRemote' }
}));

vi.mock('../src/queues/syncCurrentDraftBucketToRepo', () => ({
  syncCurrentDraftBucketToRepoQueueProcessor: { type: 'queue', name: 'syncCurrentDraftBucketToRepo' }
}));

vi.mock('../src/queues/indexServer', () => ({
  indexCustomServerQueueProcessor: { type: 'queue', name: 'indexCustomServer' }
}));

vi.mock('../src/deployment/deno/queues/main', () => ({
  denoDeployMainQueueProcessor: { type: 'queue', name: 'denoDeployMain' }
}));

vi.mock('../src/deployment/aws-lambda/queues', () => ({
  lambdaDeployMainQueueProcessor: { type: 'queue', name: 'lambdaDeployMain' },
  lambdaDeployCheckerQueueProcessor: { type: 'queue', name: 'lambdaDeployChecker' },
  lambdaDeployCompleterQueueProcessor: { type: 'queue', name: 'lambdaDeployCompleter' },
  lambdaDeployDiscoveryQueueProcessor: { type: 'queue', name: 'lambdaDeployDiscovery' },
  lambdaDeployFinalizerQueueProcessor: { type: 'queue', name: 'lambdaDeployFinalizer' }
}));

vi.mock('../src/services', () => ({
  customServerService: { name: 'customServerService' },
  customServerVersionService: { name: 'customServerVersionService' }
}));

vi.mock('../src/templates', () => ({
  managedServerTemplateService: { name: 'managedServerTemplateService' }
}));

vi.mock('@metorial/db', () => ({
  db: {
    customServer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-search', () => ({
  searchService: {
    indexDocument: vi.fn()
  }
}));

// Import after mocks are set up
import { customServerQueueProcessor } from '../src/index';
import * as indexModule from '../src/index';
import { combineQueueProcessors } from '@metorial/queue';

describe('index', () => {
  it('should export customServerQueueProcessor', () => {
    expect(customServerQueueProcessor).toBeDefined();
  });

  it('should combine all queue processors', () => {
    expect(combineQueueProcessors).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'cleanup' }),
        expect.objectContaining({ name: 'checkRemote' }),
        expect.objectContaining({ name: 'denoDeployMain' }),
        expect.objectContaining({ name: 'lambdaDeployMain' }),
        expect.objectContaining({ name: 'initializeLambda' }),
        expect.objectContaining({ name: 'initializeRemote' }),
        expect.objectContaining({ name: 'lambdaDeployChecker' }),
        expect.objectContaining({ name: 'lambdaDeployCompleter' }),
        expect.objectContaining({ name: 'syncCurrentDraftBucketToRepo' }),
        expect.objectContaining({ name: 'lambdaDeployDiscovery' }),
        expect.objectContaining({ name: 'lambdaDeployFinalizer' }),
        expect.objectContaining({ name: 'indexCustomServer' })
      ])
    );
  });

  it('should include cleanup cron in queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'cleanup' }));
  });

  it('should include checkRemote queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'checkRemote' }));
  });

  it('should include initializeLambda queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'initializeLambda' }));
  });

  it('should include initializeRemote queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'initializeRemote' }));
  });

  it('should include syncCurrentDraftBucketToRepo queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'syncCurrentDraftBucketToRepo' }));
  });

  it('should include denoDeployMain queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'denoDeployMain' }));
  });

  it('should include lambdaDeployMain queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'lambdaDeployMain' }));
  });

  it('should include lambdaDeployChecker queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'lambdaDeployChecker' }));
  });

  it('should include lambdaDeployCompleter queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'lambdaDeployCompleter' }));
  });

  it('should include lambdaDeployDiscovery queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'lambdaDeployDiscovery' }));
  });

  it('should include lambdaDeployFinalizer queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'lambdaDeployFinalizer' }));
  });

  it('should include indexCustomServer queue processor', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toContainEqual(expect.objectContaining({ name: 'indexCustomServer' }));
  });

  it('should combine exactly 12 processors', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toHaveLength(12);
  });

  it('should export services from services module', () => {
    expect(indexModule).toHaveProperty('customServerService');
    expect(indexModule).toHaveProperty('customServerVersionService');
  });

  it('should export services from templates module', () => {
    expect(indexModule).toHaveProperty('managedServerTemplateService');
  });
});
