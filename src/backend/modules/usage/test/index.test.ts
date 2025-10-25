import { describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((processors) => processors)
}));

vi.mock('@metorial/delay', () => ({
  delay: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@metorial/sentry', () => ({
  getSentry: vi.fn(() => ({
    captureException: vi.fn()
  }))
}));

vi.mock('mongoose', () => {
  const mockSchema = vi.fn(function (this: any, definition: any) {
    this.definition = definition;
    return this;
  });

  const mockModel = vi.fn(() => ({
    aggregate: vi.fn(),
    insertMany: vi.fn()
  }));

  const mockConnect = vi.fn();

  return {
    default: {
      Schema: mockSchema,
      model: mockModel,
      connect: mockConnect
    }
  };
});

import { usageService, usageQueueProcessor } from '../src/index';

describe('index', () => {
  it('should export usageService from services', () => {
    expect(usageService).toBeDefined();
    expect(typeof usageService.ingestUsageRecord).toBe('function');
    expect(typeof usageService.getUsageTimeline).toBe('function');
  });

  it('should export usageQueueProcessor', () => {
    expect(usageQueueProcessor).toBeDefined();
  });

  it('should have correct service methods', () => {
    // Verify the service has the expected methods
    expect(usageService).toHaveProperty('ingestUsageRecord');
    expect(usageService).toHaveProperty('getUsageTimeline');
  });

  it('should support ingestUsageRecord method', () => {
    expect(typeof usageService.ingestUsageRecord).toBe('function');
  });

  it('should support getUsageTimeline method', () => {
    expect(typeof usageService.getUsageTimeline).toBe('function');
  });
});
