import type { ApiKeysGetOutput } from '@metorial/dashboard-sdk';
import { subDays } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { getApiKeyPage, getVisibleApiKeys } from './visibleApiKeys';

let keys = Array.from({ length: 60 }, (_, index) => ({
  id: `key_${index}`,
  name: `Key ${index}`,
  description: '',
  status: 'active'
})) as ApiKeysGetOutput[];

describe('API key product table pagination', () => {
  it('can traverse forward and backward without repeating or skipping keys', () => {
    let first = getApiKeyPage(keys, {});
    let second = getApiKeyPage(keys, { after: first.items[24].id });
    let last = getApiKeyPage(keys, { after: second.items[24].id });
    let previous = getApiKeyPage(keys, { before: second.items[0].id });

    expect([...first.items, ...second.items, ...last.items]).toEqual(keys);
    expect(previous.items).toEqual(first.items);
    expect(first.hasMoreBefore).toBe(false);
    expect(first.hasMoreAfter).toBe(true);
    expect(second.hasMoreBefore).toBe(true);
    expect(last.hasMoreAfter).toBe(false);
  });

  it('searches metadata and recovers from a stale cursor', () => {
    expect(
      getApiKeyPage(keys, { search: ' KEY 5 ', after: 'removed-key' }).items.map(
        item => item.id
      )
    ).toEqual(['key_5', ...Array.from({ length: 10 }, (_, index) => `key_${index + 50}`)]);
    expect(getApiKeyPage(keys, { search: 'no match' }).items).toEqual([]);
  });

  it('preserves visibility of recently deleted or expired keys', () => {
    let items = [
      { ...keys[0], id: 'active' },
      {
        ...keys[0],
        id: 'recently-deleted',
        status: 'deleted',
        deletedAt: subDays(new Date(), 1)
      },
      {
        ...keys[0],
        id: 'recently-expired',
        status: 'expired',
        expiresAt: subDays(new Date(), 1)
      },
      { ...keys[0], id: 'old-deleted', status: 'deleted', deletedAt: subDays(new Date(), 10) }
    ] as ApiKeysGetOutput[];

    expect(getVisibleApiKeys(items).map(item => item.id)).toEqual([
      'active',
      'recently-deleted',
      'recently-expired'
    ]);
  });
});
