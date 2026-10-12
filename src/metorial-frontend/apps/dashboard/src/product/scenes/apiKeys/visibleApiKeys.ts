import type { ApiKeysGetOutput } from '@metorial/dashboard-sdk';
import { subDays } from 'date-fns';

let pageSize = 25;

export let getVisibleApiKeys = (items: ApiKeysGetOutput[]) => {
  let sevenDaysAgo = subDays(new Date(), 7);

  return items.filter(
    apiKey =>
      apiKey.status === 'active' ||
      (apiKey.deletedAt && apiKey.deletedAt > sevenDaysAgo) ||
      (apiKey.expiresAt && apiKey.expiresAt > sevenDaysAgo)
  );
};

export let getApiKeyPage = (
  items: ApiKeysGetOutput[],
  opts: { search?: string; before?: string; after?: string }
) => {
  let search = opts.search?.trim().toLowerCase();
  let visible = getVisibleApiKeys(items).filter(
    item =>
      !search ||
      [item.name, item.description, item.id].some(value =>
        value?.toLowerCase().includes(search)
      )
  );
  let afterIndex = opts.after ? visible.findIndex(item => item.id === opts.after) : -1;
  let beforeIndex = opts.before ? visible.findIndex(item => item.id === opts.before) : -1;
  let start =
    afterIndex >= 0
      ? afterIndex + 1
      : beforeIndex >= 0
        ? Math.max(0, beforeIndex - pageSize)
        : 0;
  let end = beforeIndex >= 0 && afterIndex < 0 ? beforeIndex : start + pageSize;

  return {
    items: visible.slice(start, end),
    hasMoreBefore: start > 0,
    hasMoreAfter: end < visible.length
  };
};
