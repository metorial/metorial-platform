import { describe, expect, it, vi } from 'vitest';

// Mock all the dependencies before importing
vi.mock('@metorial/queue', () => ({
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

vi.mock('../src/services', () => ({
  customServerService: { name: 'customServerService' },
  customServerVersionService: { name: 'customServerVersionService' }
}));

vi.mock('../src/templates', () => ({
  managedServerTemplateService: { name: 'managedServerTemplateService' }
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
        expect.objectContaining({ name: 'initializeLambda' }),
        expect.objectContaining({ name: 'initializeRemote' }),
        expect.objectContaining({ name: 'syncCurrentDraftBucketToRepo' })
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

  it('should combine exactly 5 processors', () => {
    const processors = (combineQueueProcessors as any).mock.calls[0][0];
    expect(processors).toHaveLength(5);
  });

  it('should export services from services module', () => {
    expect(indexModule).toHaveProperty('customServerService');
    expect(indexModule).toHaveProperty('customServerVersionService');
  });

  it('should export services from templates module', () => {
    expect(indexModule).toHaveProperty('managedServerTemplateService');
  });
});
