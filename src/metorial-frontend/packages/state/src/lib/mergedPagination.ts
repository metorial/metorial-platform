export type MergedListPage<T> = {
  items: T[];
  pagination: { hasMoreAfter: boolean };
};

export type MergedEntry<Items extends Record<string, { id: string }>> = {
  [K in keyof Items & string]: { source: K; item: Items[K]; group: string | null };
}[keyof Items & string];

export type MergedRow<Items extends Record<string, { id: string }>> =
  | {
      [K in keyof Items & string]: { type: 'item'; key: string; source: K; item: Items[K] };
    }[keyof Items & string]
  | {
      type: 'group';
      key: string;
      group: string;
      members: { [K in keyof Items & string]: { source: K; item: Items[K] } }[keyof Items &
        string][];
    };

export type MergedSourceInput<T extends { id: string }> = {
  pages: MergedListPage<T>[];
  enabled: boolean;
  group?: (item: T) => string | null | undefined;
};

export type MergeResult<Items extends Record<string, { id: string }>> = {
  rows: MergedRow<Items>[];
  needs: (keyof Items & string)[];
  hasMore: boolean;
};

let sortKey = (id: string) => {
  let i = id.lastIndexOf('_');
  return i == -1 ? id : id.slice(i + 1);
};

export let compareSortedIds = (a: string, b: string) => {
  let ka = sortKey(a);
  let kb = sortKey(b);
  if (ka != kb) return ka < kb ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/*
  Merges the already-fetched pages of several id-ordered lists into `target` rows.

  A head can only be chosen once every source that isn't exhausted has a buffered item,
  otherwise an unfetched item could belong before it. When that isn't the case, the merge stops
  and returns the sources in `needs`; the caller fetches their next page and merges again.
  After the target is reached the merge keeps looking for one more row, so `hasMore` never
  promises a page that excluded or grouped items would leave empty.
*/
export let mergeSources = <Items extends Record<string, { id: string }>>(d: {
  sources: { [K in keyof Items]: MergedSourceInput<Items[K]> };
  target: number;
  order: 'asc' | 'desc';
  exclude?: (entry: MergedEntry<Items>) => boolean;
}): MergeResult<Items> => {
  let keys = Object.keys(d.sources) as (keyof Items & string)[];

  let cursors = keys.map(key => {
    let source = d.sources[key];
    let seen = new Set<string>();
    let items = source.enabled
      ? source.pages
          .flatMap(page => page.items)
          .filter(item => (seen.has(item.id) ? false : (seen.add(item.id), true)))
      : [];
    let last = source.pages[source.pages.length - 1];
    let done =
      !source.enabled || (!!last && (!last.pagination.hasMoreAfter || !last.items.length));

    return { key, items, done, position: 0, group: source.group };
  });

  let compare = (a: string, b: string) =>
    d.order == 'asc' ? compareSortedIds(a, b) : -compareSortedIds(a, b);

  let rows: MergedRow<Items>[] = [];
  let groups = new Map<string, Extract<MergedRow<Items>, { type: 'group' }>>();

  for (;;) {
    let needs = cursors.filter(c => !c.done && c.position >= c.items.length).map(c => c.key);
    if (needs.length) return { rows, needs, hasMore: true };

    let next = cursors
      .filter(c => c.position < c.items.length)
      .reduce<(typeof cursors)[number] | null>(
        (best, c) =>
          !best || compare(c.items[c.position]!.id, best.items[best.position]!.id) < 0
            ? c
            : best,
        null
      );

    if (!next) return { rows, needs: [], hasMore: false };

    let item = next.items[next.position++]!;
    let groupKey = next.group?.(item) ?? null;
    let entry = { source: next.key, item, group: groupKey } as MergedEntry<Items>;

    if (d.exclude?.(entry)) continue;

    let member = { source: next.key, item } as Extract<
      MergedRow<Items>,
      { type: 'group' }
    >['members'][number];
    let existingGroup = groupKey == null ? undefined : groups.get(groupKey);

    if (existingGroup) {
      existingGroup.members.push(member);
      continue;
    }

    if (rows.length >= d.target) return { rows, needs: [], hasMore: true };

    if (groupKey == null) {
      rows.push({
        type: 'item',
        key: `${next.key}:${item.id}`,
        source: next.key,
        item
      } as MergedRow<Items>);
    } else {
      let row = {
        type: 'group' as const,
        key: `group:${groupKey}`,
        group: groupKey,
        members: [member]
      };
      groups.set(groupKey, row);
      rows.push(row);
    }
  }
};
