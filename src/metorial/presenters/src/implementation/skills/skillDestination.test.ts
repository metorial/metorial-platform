import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  getImageUrl: vi.fn(async () => 'https://example.com/image.png')
}));

import { v1SkillMarketplacePresenter } from './skillMarketplace';
import { v1SkillPluginPresenter } from './skillPlugin';
import { skillDestinationSyncStatusPresenter } from './skillDestination';

let presenterContext = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let destination = (input?: {
  isDirty?: boolean;
  mustFlushAt?: Date | null;
  syncs?: Array<{ status: 'pending' | 'processing' }>;
}) =>
  ({
    isDirty: input?.isDirty ?? false,
    mustFlushAt: input?.mustFlushAt ?? null,
    syncs: input?.syncs ?? []
  }) as any;

describe('skillDestinationSyncStatusPresenter', () => {
  it('reports a dirty destination as pending', () => {
    expect(skillDestinationSyncStatusPresenter(destination({ isDirty: true }))).toBe(
      'pending'
    );
  });

  it('reports a collected destination waiting to flush as pending', () => {
    expect(skillDestinationSyncStatusPresenter(destination({ mustFlushAt: new Date() }))).toBe(
      'pending'
    );
  });

  it('gives pending changes precedence over an older processing sync', () => {
    expect(
      skillDestinationSyncStatusPresenter(
        destination({
          isDirty: true,
          syncs: [{ status: 'processing' }]
        })
      )
    ).toBe('pending');
  });

  it.each(['pending', 'processing'] as const)(
    'reports a clean destination with a %s sync as processing',
    status => {
      expect(skillDestinationSyncStatusPresenter(destination({ syncs: [{ status }] }))).toBe(
        'processing'
      );
    }
  );

  it('reports a clean destination without active syncs as synced', () => {
    expect(skillDestinationSyncStatusPresenter(destination())).toBe('synced');
  });

  it('reports a missing destination as synced', () => {
    expect(skillDestinationSyncStatusPresenter(null)).toBe('synced');
  });
});

describe('skill destination presenters', () => {
  it('uses the shared status for marketplaces', async () => {
    let result = await v1SkillMarketplacePresenter
      .present(
        {
          skillMarketplace: {
            id: 'smp_1',
            status: 'active',
            destination: destination({ isDirty: true }),
            image: null,
            name: 'Marketplace',
            description: null,
            slug: 'marketplace',
            skillConfiguration: null,
            plugins: [],
            createdAt: new Date(),
            updatedAt: new Date()
          } as any
        },
        presenterContext
      )
      .run();

    expect(result.sync_status).toBe('pending');
  });

  it('uses the shared status for plugins', async () => {
    let result = await v1SkillPluginPresenter
      .present(
        {
          skillPlugin: {
            id: 'spl_1',
            status: 'active',
            destination: destination({ mustFlushAt: new Date() }),
            image: null,
            name: 'Plugin',
            description: null,
            longDescription: null,
            category: null,
            slug: 'plugin',
            skillConfiguration: null,
            skillPluginSkills: [],
            createdAt: new Date(),
            updatedAt: new Date()
          } as any
        },
        presenterContext
      )
      .run();

    expect(result.sync_status).toBe('pending');
  });
});
