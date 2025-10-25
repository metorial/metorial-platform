import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((processors: any[]) => processors)
}));

vi.mock('../src/definitions', () => ({
  purposeSlugs: ['user_image', 'organization_image']
}));

vi.mock('../src/services', () => ({
  fileService: { name: 'fileService' },
  fileLinkService: { name: 'fileLinkService' }
}));

// Import after mocking
import { purposeSlugs, fileService, fileLinkService, fileQueueProcessor } from '../src/index';

describe('index', () => {
  it('exports purposeSlugs from definitions', () => {
    expect(purposeSlugs).toBeDefined();
    expect(Array.isArray(purposeSlugs)).toBe(true);
    expect(purposeSlugs).toContain('user_image');
    expect(purposeSlugs).toContain('organization_image');
  });

  it('exports services from services module', () => {
    expect(fileService).toBeDefined();
    expect(fileLinkService).toBeDefined();
  });

  it('exports fileQueueProcessor', () => {
    expect(fileQueueProcessor).toBeDefined();
  });

  it('fileQueueProcessor is an array', () => {
    expect(Array.isArray(fileQueueProcessor)).toBe(true);
  });

  it('fileQueueProcessor is empty', () => {
    expect(fileQueueProcessor).toEqual([]);
  });
});
