import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    organization: { findUnique: vi.fn() },
    skillMarketplace: { findFirst: vi.fn() },
    skillGroup: { findFirst: vi.fn() },
    skillGroupPlugin: { create: vi.fn() },
    skillPlugin: { createMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    skillMarketplacePlugin: { createMany: vi.fn() }
  },
  generateId: vi.fn(),
  fire: vi.fn(),
  createDestination: vi.fn(),
  getPluginSlug: vi.fn(),
  getMembershipSlug: vi.fn(),
  getGroupSkills: vi.fn(),
  reconcileGroupMembership: vi.fn(),
  enqueuePlugin: vi.fn(),
  enqueueMembership: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: mocks.db,
  ID: { generateId: mocks.generateId },
  withTransaction: async (run: (db: typeof mocks.db) => unknown) => run(mocks.db)
}));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fire } }));
vi.mock('@metorial/list-utils', () => ({}));
vi.mock('@metorial/module-skill-configurations', () => ({}));
vi.mock('@metorial/module-consumer-access', () => ({}));
vi.mock('@metorial/module-search', () => ({}));
vi.mock('@metorial/skills-common', () => ({}));
vi.mock('@metorial/skills-images', () => ({}));
vi.mock('@metorial/skills-search', () => ({}));
vi.mock('@metorial/skills-scm-utils', () => ({
  createSkillDestination: mocks.createDestination
}));
vi.mock('../lib/destinationSync', () => ({}));
vi.mock('../lib/limits', () => ({
  CargoSkillLimitError: class extends Error {},
  assertSkillMarketplacePluginLimit: vi.fn(),
  assertSkillMarketplaceSkillLimit: vi.fn(),
  maxSkillPluginSkills: 100,
  sumSkillStoreSizes: async () => ({ files: 0, bytes: 0n }),
  assertSkillMarketplaceDestinationSize: vi.fn(),
  generatedFilesPerSkillPlugin: 1
}));
vi.mock('../lib/skillGroupPluginMembership', () => ({
  getSkillGroupPluginTargetSkills: mocks.getGroupSkills,
  reconcileSkillGroupPluginMembership: mocks.reconcileGroupMembership
}));
vi.mock('../lib/skillMarketplaceAccess', () => ({
  assertSkillMarketplaceWriteAccess: vi.fn()
}));
vi.mock('../lib/skillMarketplacePluginSlug', () => ({
  getAvailableSkillPluginSlug: mocks.getPluginSlug,
  getMarketplacePluginSlug: mocks.getMembershipSlug
}));
vi.mock('../lib/storageMode', () => ({
  getNewSkillDestinationStorageMode: async () => 'manifest'
}));
vi.mock('../queues/lifecycle', () => ({
  enqueueSkillPluginLifecycle: mocks.enqueuePlugin,
  enqueueSkillMarketplacePluginLifecycle: mocks.enqueueMembership
}));

import { skillPluginService } from './skillPlugin';

let input = {
  project: { oid: 1n, organizationOid: 2n },
  instance: { oid: 3n, organizationOid: 2n },
  auditScope: {},
  input: { name: 'Docs Helper' }
} as Parameters<typeof skillPluginService.createSkillPlugin>[0];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.generateId.mockImplementation(async (type: string) => `${type}_1`);
  mocks.db.organization.findUnique.mockResolvedValue({ oid: 2n });
  mocks.createDestination.mockResolvedValue({ oid: 4n });
  mocks.getGroupSkills.mockResolvedValue([]);
  mocks.db.skillGroupPlugin.create.mockResolvedValue({ oid: 7n });
  mocks.getPluginSlug.mockResolvedValue('docs-helper');
  mocks.getMembershipSlug.mockResolvedValue('docs-helper');
  mocks.db.skillPlugin.createMany.mockResolvedValue({ count: 1 });
  mocks.db.skillPlugin.findUniqueOrThrow.mockResolvedValue({
    id: 'skillPlugin_1',
    oid: 5n,
    slug: 'docs-helper-2'
  });
  mocks.db.skillMarketplacePlugin.createMany.mockResolvedValue({ count: 1 });
});

describe('skill plugin create slug collisions', () => {
  it('reallocates a contested slug without repeating destinations or lifecycle events', async () => {
    mocks.getPluginSlug
      .mockResolvedValueOnce('docs-helper')
      .mockResolvedValueOnce('docs-helper-2');
    mocks.db.skillPlugin.createMany.mockResolvedValueOnce({ count: 0 });

    let plugin = await skillPluginService.createSkillPlugin(input);

    expect(plugin.slug).toBe('docs-helper-2');
    expect(mocks.db.skillPlugin.createMany.mock.calls.map(([args]) => args.data.slug)).toEqual(
      ['docs-helper', 'docs-helper-2']
    );
    expect(mocks.db.skillPlugin.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
    expect(mocks.createDestination).toHaveBeenCalledTimes(1);
    expect(mocks.fire.mock.calls.map(([event]) => event)).toEqual([
      'skill.plugin.created:before',
      'skill.plugin.created:after',
      'skill.plugin.audit.created:after'
    ]);
    expect(mocks.enqueuePlugin).toHaveBeenCalledTimes(1);
  });

  it('also reallocates a contested marketplace membership slug', async () => {
    mocks.db.skillMarketplace.findFirst.mockResolvedValue({ id: 'marketplace_1', oid: 6n });
    mocks.getMembershipSlug
      .mockResolvedValueOnce('docs-helper')
      .mockResolvedValueOnce('docs-helper-2');
    mocks.db.skillMarketplacePlugin.createMany.mockResolvedValueOnce({ count: 0 });

    await skillPluginService.createSkillPlugin({
      ...input,
      skillMarketplaceId: 'marketplace_1'
    });

    expect(
      mocks.db.skillMarketplacePlugin.createMany.mock.calls.map(
        ([args]) => args.data.pluginSlug
      )
    ).toEqual(['docs-helper', 'docs-helper-2']);
    expect(mocks.db.skillPlugin.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.createDestination).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMembership).toHaveBeenCalledExactlyOnceWith({
      skillMarketplacePluginId: 'skillMarketplacePlugin_1',
      event: 'created'
    });
  });

  it('preserves group metadata when retrying plugin and marketplace slugs', async () => {
    mocks.db.skillGroup.findFirst.mockResolvedValue({
      id: 'group_1',
      oid: 8n,
      name: 'Group Helper',
      description: 'Skills from the group'
    });
    mocks.db.skillMarketplace.findFirst.mockResolvedValue({ id: 'marketplace_1', oid: 6n });
    mocks.getPluginSlug
      .mockResolvedValueOnce('group-helper')
      .mockResolvedValueOnce('group-helper-2');
    mocks.db.skillPlugin.createMany.mockResolvedValueOnce({ count: 0 });
    mocks.db.skillMarketplacePlugin.createMany.mockResolvedValueOnce({ count: 0 });

    await skillPluginService.createSkillPlugin({
      ...input,
      skillMarketplaceId: 'marketplace_1',
      input: { skillGroupId: 'group_1' }
    });

    expect(mocks.getPluginSlug.mock.calls).toEqual([['Group Helper'], ['Group Helper']]);
    expect(mocks.db.skillPlugin.createMany.mock.calls.map(([args]) => args.data)).toEqual([
      expect.objectContaining({
        name: 'Group Helper',
        description: 'Skills from the group',
        slug: 'group-helper'
      }),
      expect.objectContaining({
        name: 'Group Helper',
        description: 'Skills from the group',
        slug: 'group-helper-2'
      })
    ]);
    expect(mocks.getMembershipSlug.mock.calls).toEqual([
      [{ input: 'Group Helper' }, { skillMarketplaceId: 'marketplace_1' }],
      [{ input: 'Group Helper' }, { skillMarketplaceId: 'marketplace_1' }]
    ]);
    expect(mocks.reconcileGroupMembership).toHaveBeenCalledExactlyOnceWith({
      skillGroupPluginOid: 7n
    });
    expect(mocks.createDestination).toHaveBeenCalledTimes(1);
    expect(mocks.enqueuePlugin).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMembership).toHaveBeenCalledTimes(1);
  });

  it('bounds contention retries and does not emit successful plugin events', async () => {
    mocks.db.skillPlugin.createMany.mockResolvedValue({ count: 0 });

    await expect(skillPluginService.createSkillPlugin(input)).rejects.toMatchObject({
      data: { code: 'conflict' }
    });
    expect(mocks.db.skillPlugin.createMany).toHaveBeenCalledTimes(10);
    expect(mocks.db.skillPlugin.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(mocks.fire.mock.calls.map(([event]) => event)).toEqual([
      'skill.plugin.created:before'
    ]);
    expect(mocks.enqueuePlugin).not.toHaveBeenCalled();
  });

  it('propagates unrelated database failures without retrying', async () => {
    let error = new Error('database unavailable');
    mocks.db.skillPlugin.createMany.mockRejectedValue(error);

    await expect(skillPluginService.createSkillPlugin(input)).rejects.toBe(error);
    expect(mocks.db.skillPlugin.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.enqueuePlugin).not.toHaveBeenCalled();
  });
});
