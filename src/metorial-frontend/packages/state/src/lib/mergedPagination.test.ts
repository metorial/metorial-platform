import { describe, expect, it } from 'vitest';
import { compareSortedIds, mergeSources, type MergedListPage } from './mergedPagination';

type Item = { id: string; provider?: string };

let sortedId = (prefix: string, time: number) =>
  `${prefix}_${time.toString(36).padStart(9, '0')}abc`;

let paged = (ids: Item[], pageSize: number, order: 'asc' | 'desc' = 'asc') => {
  let sorted = [...ids].sort((a, b) =>
    order == 'asc' ? compareSortedIds(a.id, b.id) : compareSortedIds(b.id, a.id)
  );
  let pages: MergedListPage<Item>[] = [];

  for (let i = 0; i < sorted.length; i += pageSize) {
    pages.push({
      items: sorted.slice(i, i + pageSize),
      pagination: { hasMoreAfter: i + pageSize < sorted.length }
    });
  }

  return pages.length ? pages : [{ items: [], pagination: { hasMoreAfter: false } }];
};

let ids = (prefix: string, times: number[]) => times.map(t => ({ id: sortedId(prefix, t) }));

describe('compareSortedIds', () => {
  it('orders by the time part regardless of prefix', () => {
    expect(compareSortedIds(sortedId('zzz', 1), sortedId('aaa', 2))).toBeLessThan(0);
    expect(compareSortedIds(sortedId('ptm', 3), sortedId('ptm', 3))).toBe(0);
  });
});

describe('mergeSources', () => {
  it('asks for a first page from every enabled source', () => {
    let result = mergeSources<{ a: Item; b: Item; c: Item }>({
      sources: {
        a: { pages: [], enabled: true },
        b: { pages: [], enabled: true },
        c: { pages: [], enabled: false }
      },
      target: 5,
      order: 'asc'
    });

    expect(result.needs).toEqual(['a', 'b']);
    expect(result.rows).toEqual([]);
  });

  it('interleaves sources by id up to the target', () => {
    let result = mergeSources<{ a: Item; b: Item }>({
      sources: {
        a: { pages: paged(ids('a', [1, 4, 5]), 10), enabled: true },
        b: { pages: paged(ids('b', [2, 3, 6]), 10), enabled: true }
      },
      target: 4,
      order: 'asc'
    });

    expect(result.rows.map(r => r.key)).toEqual(
      ['a:1', 'b:2', 'b:3', 'a:4'].map(k => `${k[0]}:${sortedId(k[0]!, Number(k.slice(2)))}`)
    );
    expect(result.hasMore).toBe(true);
    expect(result.needs).toEqual([]);
  });

  it('stops and asks for more when a source runs dry before the target', () => {
    let result = mergeSources<{ a: Item; b: Item }>({
      sources: {
        a: { pages: [paged(ids('a', [1, 2, 7, 8]), 2)[0]!], enabled: true },
        b: { pages: paged(ids('b', [3, 4, 5]), 10), enabled: true }
      },
      target: 4,
      order: 'asc'
    });

    expect(result.rows).toHaveLength(2);
    expect(result.needs).toEqual(['a']);
  });

  it('merges in descending order', () => {
    let result = mergeSources<{ a: Item; b: Item }>({
      sources: {
        a: { pages: paged(ids('a', [1, 4]), 10, 'desc'), enabled: true },
        b: { pages: paged(ids('b', [2, 3]), 10, 'desc'), enabled: true }
      },
      target: 10,
      order: 'desc'
    });

    expect(result.rows.map(r => (r.type == 'item' ? r.item.id : ''))).toEqual([
      sortedId('a', 4),
      sortedId('b', 3),
      sortedId('b', 2),
      sortedId('a', 1)
    ]);
    expect(result.hasMore).toBe(false);
  });

  it('skips excluded items without counting them', () => {
    let excluded = new Set([sortedId('a', 1), sortedId('b', 2)]);
    let result = mergeSources<{ a: Item; b: Item }>({
      sources: {
        a: { pages: paged(ids('a', [1, 4, 5]), 10), enabled: true },
        b: { pages: paged(ids('b', [2, 3]), 10), enabled: true }
      },
      target: 3,
      order: 'asc',
      exclude: entry => excluded.has(entry.item.id)
    });

    expect(result.rows.map(r => (r.type == 'item' ? r.item.id : ''))).toEqual([
      sortedId('b', 3),
      sortedId('a', 4),
      sortedId('a', 5)
    ]);
    expect(result.hasMore).toBe(false);
  });

  it('reports no more rows when only excluded items remain', () => {
    let result = mergeSources<{ a: Item }>({
      sources: { a: { pages: paged(ids('a', [1, 2, 3]), 10), enabled: true } },
      target: 1,
      order: 'asc',
      exclude: entry => entry.item.id != sortedId('a', 1)
    });

    expect(result.rows).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it('looks ahead into the next page before promising more rows', () => {
    let pages = paged(ids('a', [1, 2, 3]), 2);
    let result = mergeSources<{ a: Item }>({
      sources: { a: { pages: [pages[0]!], enabled: true } },
      target: 2,
      order: 'asc'
    });

    expect(result.rows).toHaveLength(2);
    expect(result.needs).toEqual(['a']);
  });

  it('groups items from several sources into one row', () => {
    let integrations: Item[] = [
      { id: sortedId('int', 1), provider: 'github' },
      { id: sortedId('int', 4), provider: 'linear' },
      { id: sortedId('int', 6), provider: 'github' }
    ];
    let servers: Item[] = [{ id: sortedId('mgsr', 2), provider: 'github' }];
    let skills = ids('skl', [3]);

    let result = mergeSources<{ integrations: Item; servers: Item; skills: Item }>({
      sources: {
        integrations: {
          pages: paged(integrations, 10),
          enabled: true,
          group: i => i.provider
        },
        servers: { pages: paged(servers, 10), enabled: true, group: i => i.provider },
        skills: { pages: paged(skills, 10), enabled: true }
      },
      target: 10,
      order: 'asc'
    });

    expect(result.rows.map(r => r.key)).toEqual([
      'group:github',
      `skills:${sortedId('skl', 3)}`,
      'group:linear'
    ]);

    let github = result.rows[0]!;
    expect(github.type == 'group' && github.members.map(m => m.source)).toEqual([
      'integrations',
      'servers',
      'integrations'
    ]);
  });

  it('excludes a whole group by its key', () => {
    let result = mergeSources<{ integrations: Item }>({
      sources: {
        integrations: {
          pages: paged(
            [
              { id: sortedId('int', 1), provider: 'github' },
              { id: sortedId('int', 2), provider: 'linear' }
            ],
            10
          ),
          enabled: true,
          group: i => i.provider
        }
      },
      target: 10,
      order: 'asc',
      exclude: entry => entry.group == 'github'
    });

    expect(result.rows.map(r => r.key)).toEqual(['group:linear']);
  });

  it('drops items repeated across pages after a refresh', () => {
    let a = ids('a', [1, 2]);
    let result = mergeSources<{ a: Item }>({
      sources: {
        a: {
          pages: [
            { items: a, pagination: { hasMoreAfter: true } },
            { items: [a[1]!], pagination: { hasMoreAfter: false } }
          ],
          enabled: true
        }
      },
      target: 10,
      order: 'asc'
    });

    expect(result.rows).toHaveLength(2);
  });
});
