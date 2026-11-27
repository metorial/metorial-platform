import { describe, expect, it } from 'vitest';
import { pageAuthorizations, sortAuthorizations } from './authorizationPaging';

let at = (id: string, minutes: number) => ({
  id,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, minutes))
});

let items = [at('a', 1), at('b', 2), at('c', 3), at('d', 4), at('e', 5)];

describe('sortAuthorizations', () => {
  it('orders newest first and breaks ties by id', () => {
    let sorted = sortAuthorizations([at('x', 1), at('y', 3), at('z', 3), at('w', 2)]);

    expect(sorted.map(item => item.id)).toEqual(['z', 'y', 'w', 'x']);
  });

  it('does not change the input', () => {
    let input = [at('a', 1), at('b', 2)];
    sortAuthorizations(input);

    expect(input.map(item => item.id)).toEqual(['a', 'b']);
  });
});

describe('pageAuthorizations', () => {
  let newestFirst = sortAuthorizations(items);

  it('returns the first page with a next cursor and no previous cursor', () => {
    let page = pageAuthorizations(newestFirst, {
      order: 'desc',
      limit: 2,
      direction: 'forward'
    });

    expect(page.items.map(item => item.id)).toEqual(['e', 'd']);
    expect(page.nextCursor).toBe('d');
    expect(page.prevCursor).toBeUndefined();
  });

  it('walks forward through every item exactly once', () => {
    let seen: string[] = [];
    let cursor: string | undefined;

    for (let step = 0; step < 10; step++) {
      let page = pageAuthorizations(newestFirst, {
        order: 'desc',
        limit: 2,
        direction: 'forward',
        cursor
      });
      seen.push(...page.items.map(item => item.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    expect(seen).toEqual(['e', 'd', 'c', 'b', 'a']);
  });

  it('pages backward from a cursor', () => {
    let page = pageAuthorizations(newestFirst, {
      order: 'desc',
      limit: 2,
      direction: 'backward',
      cursor: 'b'
    });

    expect(page.items.map(item => item.id)).toEqual(['d', 'c']);
    expect(page.nextCursor).toBe('c');
    expect(page.prevCursor).toBe('d');
  });

  it('supports ascending order', () => {
    let page = pageAuthorizations(newestFirst, {
      order: 'asc',
      limit: 3,
      direction: 'forward'
    });

    expect(page.items.map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(page.nextCursor).toBe('c');
  });

  it('has no cursors when everything fits on one page', () => {
    let page = pageAuthorizations(newestFirst, {
      order: 'desc',
      limit: 50,
      direction: 'forward'
    });

    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).toBeUndefined();
    expect(page.prevCursor).toBeUndefined();
  });

  it('returns an empty page for an empty list', () => {
    expect(pageAuthorizations([], { order: 'desc', limit: 5, direction: 'forward' })).toEqual({
      items: [],
      nextCursor: undefined,
      prevCursor: undefined
    });
  });
});
