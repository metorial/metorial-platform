import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  globalFindMany: vi.fn(),
  globalFindFirst: vi.fn(),
  localFindMany: vi.fn(),
  localFindFirst: vi.fn(),
  localFindUnique: vi.fn(),
  localFindUniqueOrThrow: vi.fn(),
  localUpdateMany: vi.fn(),
  cellFindFirst: vi.fn(),
  fire: vi.fn(),
  generateCode: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    skillPlugin: {
      findMany: mocks.localFindMany,
      findFirst: mocks.localFindFirst,
      findUnique: mocks.localFindUnique,
      findUniqueOrThrow: mocks.localFindUniqueOrThrow,
      updateMany: mocks.localUpdateMany
    },
    cellSkillPlugin: {
      findFirst: mocks.cellFindFirst
    }
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: mocks.fire }
}));

vi.mock('@metorial/id', () => ({
  generateCode: mocks.generateCode
}));

vi.mock('../db', () => ({
  globalDB: {
    skillPlugin: {
      findMany: mocks.globalFindMany,
      findFirst: mocks.globalFindFirst
    }
  }
}));

import { findYoungerLocalSlugClaims, reconcileSkillPluginSlug } from './skillPluginSlug';

let plugin = {
  id: 'skp_b',
  slug: 'github',
  status: 'active',
  createdAt: new Date('2026-02-01T00:00:00Z')
};

describe('reconcileSkillPluginSlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.globalFindMany.mockResolvedValue([]);
    mocks.localFindMany.mockResolvedValue([]);
    mocks.globalFindFirst.mockResolvedValue(null);
    mocks.localFindFirst.mockResolvedValue(null);
    mocks.cellFindFirst.mockResolvedValue(null);
    mocks.localUpdateMany.mockResolvedValue({ count: 1 });
    mocks.localFindUniqueOrThrow.mockResolvedValue({ ...plugin, slug: 'github-4821' });
    mocks.generateCode.mockReturnValue('4821');
  });

  it('keeps the slug when no other active plugin claims it', async () => {
    await expect(reconcileSkillPluginSlug(plugin)).resolves.toBe('github');

    expect(mocks.globalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'github', status: 'active', id: { not: 'skp_b' } }
      })
    );
    expect(mocks.localUpdateMany).not.toHaveBeenCalled();
    expect(mocks.fire).not.toHaveBeenCalled();
  });

  it('keeps the slug when it is the oldest claim', async () => {
    mocks.globalFindMany.mockResolvedValue([
      { id: 'skp_c', createdAt: new Date('2026-03-01T00:00:00Z') }
    ]);

    await expect(reconcileSkillPluginSlug(plugin)).resolves.toBe('github');
    expect(mocks.localUpdateMany).not.toHaveBeenCalled();
  });

  it('renames the younger plugin when another cell claimed the slug first', async () => {
    mocks.globalFindMany.mockResolvedValue([
      { id: 'skp_a', createdAt: new Date('2026-01-01T00:00:00Z') }
    ]);

    await expect(reconcileSkillPluginSlug(plugin)).resolves.toBe('github-4821');

    expect(mocks.localUpdateMany).toHaveBeenCalledWith({
      where: { id: 'skp_b', slug: 'github' },
      data: { slug: 'github-4821' }
    });
    expect(mocks.fire).toHaveBeenCalledWith('skill.plugin.slug.reassigned:after', {
      skillPlugin: expect.objectContaining({ id: 'skp_b', slug: 'github-4821' }),
      previousSlug: 'github'
    });
  });

  it('breaks createdAt ties by id', async () => {
    mocks.globalFindMany.mockResolvedValue([{ id: 'skp_a', createdAt: plugin.createdAt }]);
    await expect(reconcileSkillPluginSlug(plugin)).resolves.toBe('github-4821');

    mocks.globalFindMany.mockResolvedValue([{ id: 'skp_c', createdAt: plugin.createdAt }]);
    await expect(reconcileSkillPluginSlug(plugin)).resolves.toBe('github');
  });

  it('keeps the slug for the next sync when the new slug was taken locally in the meantime', async () => {
    mocks.globalFindMany.mockResolvedValue([
      { id: 'skp_a', createdAt: new Date('2026-01-01T00:00:00Z') }
    ]);
    mocks.localUpdateMany.mockRejectedValue({ code: 'P2002' });

    await expect(reconcileSkillPluginSlug(plugin)).resolves.toBe('github');
    expect(mocks.fire).not.toHaveBeenCalled();
  });

  it('accepts serialized createdAt values from queue payloads', async () => {
    mocks.globalFindMany.mockResolvedValue([
      { id: 'skp_a', createdAt: new Date('2026-01-01T00:00:00Z') }
    ]);

    await expect(
      reconcileSkillPluginSlug({ ...plugin, createdAt: plugin.createdAt.toISOString() })
    ).resolves.toBe('github-4821');
  });

  it('skips suffixes that are taken in any database', async () => {
    mocks.globalFindMany.mockResolvedValue([
      { id: 'skp_a', createdAt: new Date('2026-01-01T00:00:00Z') }
    ]);
    mocks.generateCode.mockReturnValueOnce('1111').mockReturnValueOnce('2222');
    mocks.cellFindFirst.mockResolvedValueOnce({ id: 'skp_x' });

    await expect(reconcileSkillPluginSlug(plugin)).resolves.toBe('github-2222');
    expect(mocks.cellFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'github-1111', id: { not: 'skp_b' } } })
    );
  });

  it('returns the current slug without firing when the plugin changed concurrently', async () => {
    mocks.globalFindMany.mockResolvedValue([
      { id: 'skp_a', createdAt: new Date('2026-01-01T00:00:00Z') }
    ]);
    mocks.localUpdateMany.mockResolvedValue({ count: 0 });
    mocks.localFindUnique.mockResolvedValue({ slug: 'github-9999' });

    await expect(reconcileSkillPluginSlug(plugin)).resolves.toBe('github-9999');
    expect(mocks.fire).not.toHaveBeenCalled();
  });

  it('ignores plugins that are not active or have no slug', async () => {
    await expect(reconcileSkillPluginSlug({ ...plugin, status: 'archived' })).resolves.toBe(
      'github'
    );
    await expect(reconcileSkillPluginSlug({ ...plugin, slug: null })).resolves.toBeNull();
    expect(mocks.globalFindMany).not.toHaveBeenCalled();
  });
});

describe('findYoungerLocalSlugClaims', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only local claims created after the remote plugin', async () => {
    mocks.localFindMany.mockResolvedValue([
      { id: 'skp_old', createdAt: new Date('2025-12-01T00:00:00Z') },
      { id: 'skp_new', createdAt: new Date('2026-03-01T00:00:00Z') }
    ]);

    await expect(
      findYoungerLocalSlugClaims({ ...plugin, createdAt: plugin.createdAt.toISOString() })
    ).resolves.toEqual([{ id: 'skp_new', createdAt: new Date('2026-03-01T00:00:00Z') }]);
  });

  it('does nothing for plugins without a slug', async () => {
    await expect(findYoungerLocalSlugClaims({ ...plugin, slug: null })).resolves.toEqual([]);
    expect(mocks.localFindMany).not.toHaveBeenCalled();
  });
});
