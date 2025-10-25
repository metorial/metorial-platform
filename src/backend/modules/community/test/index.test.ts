import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a mock function that we can track
const mockCombineQueueProcessors = vi.fn((processors) => ({
  type: 'combined',
  processors
}));

// Mock dependencies before importing
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: mockCombineQueueProcessors
}));

vi.mock('@metorial/db', () => ({
  db: {
    profile: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    profileUpdate: {
      create: vi.fn(),
      deleteMany: vi.fn()
    },
    serverVariantProvider: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  }
}));

vi.mock('@metorial/slugify', () => ({
  createSlugGenerator: vi.fn(() => vi.fn(async ({ input }: { input: string }) => `${input}-slug`))
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name: string, factory: () => any) => ({
      build: vi.fn(() => factory())
    }))
  }
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({
    config,
    handler,
    name: config.name,
    cron: config.cron
  }))
}));

describe('Community Module Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export profileService from services', async () => {
    const { profileService } = await import('../src/index');

    expect(profileService).toBeDefined();
  });

  it('should export communityQueueProcessor', async () => {
    const { communityQueueProcessor } = await import('../src/index');

    expect(communityQueueProcessor).toBeDefined();
  });

  it('should have correct structure for communityQueueProcessor', async () => {
    const { communityQueueProcessor } = await import('../src/index');
    const processor = communityQueueProcessor as any;

    expect(communityQueueProcessor).toBeDefined();
    expect(processor.type).toBe('combined');
  });

  it('should include cleanupCron in the processor array', async () => {
    const { communityQueueProcessor } = await import('../src/index');
    const { cleanupCron } = await import('../src/cron/cleanup');
    const processor = communityQueueProcessor as any;

    expect(processor.processors).toBeDefined();
    expect(processor.processors).toContain(cleanupCron);
    expect(processor.processors).toHaveLength(1);
  });

  it('should have cleanupCron with correct configuration', async () => {
    const { cleanupCron } = await import('../src/cron/cleanup');
    const cron = cleanupCron as any;

    expect(cron.config).toBeDefined();
    expect(cron.config.name).toBe('community/cleanup');
    expect(cron.config.cron).toBe('0 0 * * *');
  });

  it('should export all service exports', async () => {
    const exports = await import('../src/index');

    // Verify that profileService is exported (from services)
    expect(exports.profileService).toBeDefined();

    // Verify that communityQueueProcessor is exported
    expect(exports.communityQueueProcessor).toBeDefined();
  });

  it('should have processors array with exactly one cron job', async () => {
    const { communityQueueProcessor } = await import('../src/index');
    const processor = communityQueueProcessor as any;

    expect(processor.processors).toBeDefined();
    expect(Array.isArray(processor.processors)).toBe(true);
    expect(processor.processors).toHaveLength(1);
  });

  it('should maintain module structure with proper exports', async () => {
    const moduleExports = await import('../src/index');
    const exportKeys = Object.keys(moduleExports);

    // Should have at least profileService and communityQueueProcessor
    expect(exportKeys).toContain('profileService');
    expect(exportKeys).toContain('communityQueueProcessor');
  });
});
