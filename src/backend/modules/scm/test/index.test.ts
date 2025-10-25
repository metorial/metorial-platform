// @ts-nocheck - Test file with dynamic imports and mocked types
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock queue module
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((processors) => processors)
}));

// Mock queue processors
vi.mock('../src/queue/createRepoWebhook', () => ({
  createRepoWebhookQueueProcessor: { name: 'createRepoWebhook' }
}));

vi.mock('../src/queue/handleRepoPush', () => ({
  createHandleRepoPushQueueProcessor: { name: 'handleRepoPush' },
  createHandleRepoPushForCustomServerQueueProcessor: { name: 'handleRepoPushForCustomServer' }
}));

describe('SCM Module Exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export scmQueueProcessor', async () => {
    const { scmQueueProcessor } = await import('../src/index');

    expect(scmQueueProcessor).toBeDefined();
    expect(Array.isArray(scmQueueProcessor)).toBe(true);
  });

  it('should combine all queue processors', async () => {
    // Reset and re-import to test
    vi.resetModules();

    // Redefine mock
    vi.doMock('@metorial/queue', () => ({
      combineQueueProcessors: vi.fn((processors) => processors)
    }));

    const { scmQueueProcessor } = await import('../src/index');

    // The processor should be an array with 3 items
    expect(scmQueueProcessor).toHaveLength(3);
    expect(Array.isArray(scmQueueProcessor)).toBe(true);
  });

  it('should export services', async () => {
    // Reset modules to test exports
    vi.resetModules();

    // Mock all dependencies
    vi.mock('@metorial/service', () => ({
      Service: {
        create: vi.fn(() => ({
          build: vi.fn(() => ({ name: 'mockService' }))
        }))
      }
    }));

    vi.mock('@metorial/db', () => ({
      db: {},
      ID: { generateId: vi.fn() }
    }));

    vi.mock('@metorial/config', () => ({
      getFullConfig: vi.fn()
    }));

    vi.mock('@metorial/id', () => ({
      generatePlainId: vi.fn()
    }));

    vi.mock('../src/env', () => ({
      env: { gh: {} }
    }));

    const module = await import('../src/index');

    // Verify that services are exported
    expect(module).toHaveProperty('scmAuthService');
    expect(module).toHaveProperty('scmInstallationService');
    expect(module).toHaveProperty('scmRepoService');
  });

  it('should export types', async () => {
    const module = await import('../src/index');

    // The types are exported, but we can't directly test type exports in runtime
    // Just verify the module loads without errors
    expect(module).toBeDefined();
  });

  it('should export queue processor as an array', async () => {
    const { scmQueueProcessor } = await import('../src/index');

    expect(Array.isArray(scmQueueProcessor)).toBe(true);
    expect(scmQueueProcessor.length).toBeGreaterThan(0);
  });
});

describe('Module structure', () => {
  it('should have all required exports', async () => {
    const module = await import('../src/index');

    // Check for queue processor
    expect(module.scmQueueProcessor).toBeDefined();

    // Check for services (these come from services/index which exports from service files)
    expect(module.scmAuthService).toBeDefined();
    expect(module.scmInstallationService).toBeDefined();
    expect(module.scmRepoService).toBeDefined();
  });

  it('should not expose internal implementation details', async () => {
    const module = await import('../src/index');

    // These should not be exported from the main index
    expect(module).not.toHaveProperty('createRepoWebhookQueue');
    expect(module).not.toHaveProperty('createHandleRepoPushQueue');
  });

  it('should export queue processor with correct structure', async () => {
    const { scmQueueProcessor } = await import('../src/index');

    expect(scmQueueProcessor).toBeDefined();
    // It's an array of queue processors
    expect(Array.isArray(scmQueueProcessor)).toBe(true);
  });
});
