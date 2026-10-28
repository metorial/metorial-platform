import { beforeEach, describe, expect, it, vi } from 'vitest';

let { findFirst, pluginFindFirst, cellPluginFindFirst, generatePlainId } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  pluginFindFirst: vi.fn(),
  cellPluginFindFirst: vi.fn(),
  generatePlainId: vi.fn()
}));

vi.mock('@lowerdeck/id', () => ({
  generatePlainId
}));

vi.mock('@metorial/db', () => ({
  db: {
    skillMarketplacePlugin: {
      findFirst
    },
    skillPlugin: {
      findFirst: pluginFindFirst
    },
    cellSkillPlugin: {
      findFirst: cellPluginFindFirst
    }
  }
}));

import {
  getArchivedMarketplacePluginSlug,
  getAvailableSkillPluginSlug,
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

  it('uses a random plugin slug when the name has no slug characters', () => {
    expect(getSkillPluginSlug('!!!')).toBe('randomslugvalue123456');
    expect(generatePlainId).toHaveBeenCalledWith(8);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('uses the plain plugin slug when no local or synced plugin has it', async () => {
    pluginFindFirst.mockResolvedValue(null);
    cellPluginFindFirst.mockResolvedValue(null);

    await expect(getAvailableSkillPluginSlug('My Skill Plugin')).resolves.toBe(
      'my-skill-plugin'
    );
  });

  it('suffixes plugin slugs taken locally or by another cell', async () => {
    pluginFindFirst.mockResolvedValueOnce({ id: 'local' }).mockResolvedValue(null);
    cellPluginFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'remote' })
      .mockResolvedValue(null);

    await expect(getAvailableSkillPluginSlug('My Skill Plugin')).resolves.toBe(
      'my-skill-plugin-3'
    );
    expect(cellPluginFindFirst).toHaveBeenCalledWith({
      where: { slug: 'my-skill-plugin-2' },
      select: { id: true }
    });
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
