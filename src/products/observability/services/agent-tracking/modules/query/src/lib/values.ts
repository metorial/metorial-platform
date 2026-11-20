import type { QueryScope } from '@mtsrc/agent-tracking-module-usage';

type ValueItem = {
  value: string | number | boolean | null;
  label: Record<string, string | null> | null;
  count: number;
};

let matchesSearch = (search: string, ...candidates: (string | null | undefined)[]) =>
  candidates.some(candidate => candidate?.toLowerCase().includes(search));

// Entities of a kind belong to the whole organization, so adding unseen ones to the values of a
// scoped caller would list people who never sent data there.
export let allowsEntityFallback = (scope: QueryScope | undefined) =>
  !scope?.projectIds?.length && !scope?.instanceIds?.length;

export let filterValues = (d: {
  values: ValueItem[];
  search: string | undefined;
  matchingIds: Set<string>;
}) =>
  d.values
    .filter(item => item.value !== null && item.value !== '$other')
    .filter(
      item =>
        !d.search ||
        matchesSearch(d.search, String(item.value), item.label?.name, item.label?.slug) ||
        (typeof item.value == 'string' && d.matchingIds.has(item.value))
    );
