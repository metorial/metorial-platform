import { beforeEach, describe, expect, it, vi } from 'vitest';

let { findFirst, generatePlainId } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  generatePlainId: vi.fn()
}));

vi.mock('@lowerdeck/id', () => ({
  generatePlainId
}));

vi.mock('@metorial/db', () => ({
  db: {
    skillMarketplacePlugin: {
      findFirst
    }
  }
}));

import {
  getArchivedMarketplacePluginSlug,
  getMarketplacePluginSlug,
  getSkillPluginSlug
} from './skillMarketplacePluginSlug';

describe('skill plugin slugs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generatePlainId.mockReturnValue('RandomSlugValue123456');
  });

  it('creates a stable plugin slug from the supplied name', () => {
    expect(getSkillPluginSlug('My_Skill Plugin')).toBe('my-skill-plugin');
    expect(generatePlainId).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('uses the nice marketplace slug when it is available', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      getMarketplacePluginSlug(
        { input: 'My Skill Plugin' },
        { skillMarketplaceId: 'marketplace_1' }
      )
    ).resolves.toBe('my-skill-plugin');
  });

  it('uses the existing suffix generator for real marketplace conflicts', async () => {
    findFirst.mockResolvedValueOnce({ id: 'conflict' }).mockResolvedValueOnce(null);

    await expect(
      getMarketplacePluginSlug(
        { input: 'My Skill Plugin' },
        { skillMarketplaceId: 'marketplace_1' }
      )
    ).resolves.toBe('my-skill-plugin-2');
  });

  it('replaces an archived marketplace slug with a random value', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      getArchivedMarketplacePluginSlug({ skillMarketplaceId: 'marketplace_1' })
    ).resolves.toBe('randomslugvalue123456');
  });
});
