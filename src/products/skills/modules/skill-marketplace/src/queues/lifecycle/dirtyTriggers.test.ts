import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mark, hooks, findConfiguration } = vi.hoisted(() => ({
  mark: vi.fn(),
  hooks: [] as (() => Promise<void>)[],
  findConfiguration: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {},
  withTransaction: async (run: (db: unknown) => unknown) =>
    run({
      skillDestination: { updateMany: mark },
      skillConfiguration: { findUnique: findConfiguration }
    }),
  addAfterTransactionHook: (hook: () => Promise<void>) => hooks.push(hook)
}));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run }),
  combineQueueProcessors: () => ({})
}));
vi.mock('@metorial/fabric', () => ({ Fabric: {} }));
vi.mock('@metorial/module-skill-marketplace', () => ({
  enqueueManagedSkillPluginLifecycle: vi.fn()
}));
vi.mock('@metorial/module-skill-groups', () => ({ indexSkillGroupQueue: {} }));
vi.mock('../search/skillMarketplace', () => ({ indexSkillMarketplaceQueue: {} }));
vi.mock('../search/skillPlugin', () => ({ indexSkillPluginQueue: {} }));
vi.mock('../../../../skill/src/queues/search/skill', () => ({ indexSkillQueue: {} }));

import { enqueueSkillLifecycle } from '../../../../skill/src/queues/lifecycle/skill';
import { enqueueSkillPluginLifecycle } from './skillPlugin';
import { enqueueSkillMarketplacePluginLifecycle } from './skillMarketplacePlugin';
import { enqueueSkillPluginSkillLifecycle } from './skillPluginSkill';
import { enqueueSkillConfigurationLifecycle } from '../../../../skill-configurations/src/queues/lifecycle';
import { enqueueStoreLifecycle } from '../../../../../../storage/modules/store/src/queues/lifecycle';
import { enqueueDocumentLifecycle } from '../../../../../../storage/modules/doc/src/queues/lifecycle';

describe('durable sync triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.length = 0;
    findConfiguration.mockResolvedValue({
      id: 'config_1',
      projectOid: 1n,
      instanceOid: 2n,
      isDefault: true
    });
  });

  it.each([
    ['skill', () => enqueueSkillLifecycle({ skillId: 'skill_1', event: 'updated' })],
    [
      'plugin',
      () => enqueueSkillPluginLifecycle({ skillPluginId: 'plugin_1', event: 'updated' })
    ],
    [
      'marketplace plugin link',
      () =>
        enqueueSkillMarketplacePluginLifecycle({
          skillMarketplacePluginId: 'link_1',
          event: 'archived'
        })
    ],
    [
      'plugin skill link',
      () =>
        enqueueSkillPluginSkillLifecycle({ skillPluginSkillId: 'link_1', event: 'archived' })
    ],
    [
      'configuration',
      () =>
        enqueueSkillConfigurationLifecycle({
          skillConfigurationId: 'config_1',
          event: 'updated'
        })
    ],
    [
      'store contents',
      () => enqueueStoreLifecycle({ storeId: 'store_1', event: 'contents-changed' })
    ],
    [
      'document contents',
      () => enqueueDocumentLifecycle({ documentId: 'doc_1', event: 'contents-changed' })
    ]
  ] as const)(
    'records dirty state for %s without running any queued work',
    async (_, trigger) => {
      await trigger();

      expect(mark).toHaveBeenCalledOnce();
      expect(mark).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isDirty: true, lastTransientChangeAt: expect.any(Date) }
        })
      );
      expect(hooks).toHaveLength(1);
    }
  );

  it('marks linked marketplaces as well as a standalone plugin destination', async () => {
    await enqueueSkillPluginLifecycle({ skillPluginId: 'plugin_1', event: 'updated' });

    expect(mark).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { skillPlugin: { id: 'plugin_1' } },
            { skillMarketplace: { plugins: { some: { skillPlugin: { id: 'plugin_1' } } } } }
          ]
        }
      })
    );
  });
});
