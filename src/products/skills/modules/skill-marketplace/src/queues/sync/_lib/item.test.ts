import { describe, expect, it } from 'vitest';
import { getSyncItemKey, getSyncTaskItemWhere } from './item';

describe('sync destination item identity', () => {
  it('keeps marketplace, plugin, and skill records distinct', () => {
    expect(
      getSyncItemKey({
        skillMarketplace: { id: 'marketplace' },
        skillPlugin: null,
        skill: null
      })
    ).toBe('marketplace:marketplace');
    expect(
      getSyncItemKey({
        skillMarketplace: { id: 'marketplace' },
        skillPlugin: { id: 'plugin' },
        skill: null
      })
    ).toBe('plugin:plugin');
    expect(
      getSyncItemKey({
        skillMarketplace: { id: 'marketplace' },
        skillPlugin: { id: 'plugin' },
        skill: { id: 'skill' }
      })
    ).toBe('skill:skill:plugin');
  });

  it('uses type-strict filters when updating hashes', () => {
    expect(
      getSyncTaskItemWhere({
        type: 'marketplace',
        action: 'set',
        skillMarketplaceId: 'marketplace'
      })
    ).toEqual({
      skillMarketplace: { id: 'marketplace' },
      skillPluginOid: null,
      skillOid: null
    });
    expect(
      getSyncTaskItemWhere({
        type: 'plugin',
        action: 'set',
        skillPluginId: 'plugin'
      })
    ).toEqual({
      skillPlugin: { id: 'plugin' },
      skillOid: null
    });
  });
});
