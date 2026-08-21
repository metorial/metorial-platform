import { describe, expect, it, vi } from 'vitest';
import { Cursor } from './cursor';
import { paginatedProviderExternalCursor } from './paginatedProvider';
import { Paginator } from './paginator';

describe('Cursor', () => {
  it('round-trips an opaque adapter token', () => {
    let encoded = Cursor.fromId('adapter-token-1', 'after').toString();

    expect(Cursor.isEncoded(encoded)).toBe(true);

    let decoded = Cursor.fromString(encoded);
    expect(decoded.type).toBe('after');
    expect(decoded.id).toBe('adapter-token-1');
  });
});

describe('paginatedProviderExternalCursor', () => {
  it('maps a first page to forward with no cursor', async () => {
    let fetch = vi.fn(async () => ({
      items: [{ id: 'ws_1' }],
      nextCursor: 'n1',
      prevCursor: undefined
    }));

    let list = await paginatedProviderExternalCursor(fetch)({
      limit: 20,
      order: 'asc'
    });

    expect(fetch).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 20,
      direction: 'forward'
    });
    expect(list.items).toEqual([{ id: 'ws_1' }]);
    expect(list.pagination.hasNextPage).toBe(true);
    expect(list.pagination.hasPreviousPage).toBe(false);
    expect(list.pagination.after).toBe(Cursor.fromId('n1', 'after').toString());
    expect(list.pagination.before).toBeUndefined();
  });

  it('maps after to a forward adapter page', async () => {
    let fetch = vi.fn(async () => ({
      items: [{ id: 'ws_2' }],
      nextCursor: 'n2',
      prevCursor: 'p2'
    }));

    let list = await paginatedProviderExternalCursor(fetch)({
      limit: 10,
      after: 'raw-adapter-cursor',
      order: 'asc'
    });

    expect(fetch).toHaveBeenCalledWith({
      cursor: 'raw-adapter-cursor',
      limit: 10,
      direction: 'forward'
    });
    expect(list.pagination.after).toBe(Cursor.fromId('n2', 'after').toString());
    expect(list.pagination.before).toBe(Cursor.fromId('p2', 'before').toString());
  });

  it('maps before to a backward adapter page', async () => {
    let fetch = vi.fn(async () => ({ items: [], prevCursor: 'p1' }));

    await paginatedProviderExternalCursor(fetch)({
      limit: 10,
      before: 'raw-adapter-cursor',
      order: 'asc'
    });

    expect(fetch).toHaveBeenCalledWith({
      cursor: 'raw-adapter-cursor',
      limit: 10,
      direction: 'backward'
    });
  });

  it('decodes a cur_ token passed as after', async () => {
    let fetch = vi.fn(async () => ({ items: [] }));
    let encoded = Cursor.fromId('inner-token', 'after').toString();

    await paginatedProviderExternalCursor(fetch)({
      limit: 5,
      after: encoded,
      order: 'asc'
    });

    expect(fetch).toHaveBeenCalledWith({
      cursor: 'inner-token',
      limit: 5,
      direction: 'forward'
    });
  });

  it('uses the encoded cursor type when a before token is passed as after', async () => {
    let fetch = vi.fn(async () => ({ items: [] }));
    let encoded = Cursor.fromId('inner-token', 'before').toString();

    await paginatedProviderExternalCursor(fetch)({
      limit: 5,
      after: encoded,
      order: 'asc'
    });

    expect(fetch).toHaveBeenCalledWith({
      cursor: 'inner-token',
      limit: 5,
      direction: 'backward'
    });
  });

  it('leaves next/prev empty when the adapter is exhausted', async () => {
    let list = await paginatedProviderExternalCursor(async () => ({
      items: [{ id: 'ws_1' }]
    }))({
      limit: 20,
      order: 'asc'
    });

    expect(list.pagination.hasNextPage).toBe(false);
    expect(list.pagination.hasPreviousPage).toBe(false);
    expect(list.pagination.after).toBeUndefined();
    expect(list.pagination.before).toBeUndefined();
  });
});

describe('Paginator present', () => {
  it('omits after/before when they are unset', async () => {
    let presented = await Paginator.presentLight(
      {
        items: [{ id: 'a' }],
        pagination: { hasNextPage: true, hasPreviousPage: false }
      },
      item => item
    );

    expect(presented.pagination).toEqual({
      has_more_after: true,
      has_more_before: false
    });
  });

  it('includes encoded after/before when set', async () => {
    let after = Cursor.fromId('n1', 'after').toString();
    let presented = await Paginator.presentLight(
      {
        items: [{ id: 'a' }],
        pagination: {
          hasNextPage: true,
          hasPreviousPage: true,
          after,
          before: Cursor.fromId('p1', 'before').toString()
        }
      },
      item => item
    );

    expect(presented.pagination).toEqual({
      has_more_after: true,
      has_more_before: true,
      after,
      before: Cursor.fromId('p1', 'before').toString()
    });
  });

  it('decodes a cursor query param before calling the external provider', async () => {
    let fetch = vi.fn(async () => ({ items: [{ id: 'ws_2' }], nextCursor: 'n2' }));
    let paginator = Paginator.create(({ externalCursor }) => externalCursor(fetch));
    let encoded = Cursor.fromId('adapter-page', 'after').toString();

    let list = await paginator.run({ cursor: encoded, limit: 10 });

    expect(fetch).toHaveBeenCalledWith({
      cursor: 'adapter-page',
      limit: 10,
      direction: 'forward'
    });
    expect(list.pagination.after).toBe(Cursor.fromId('n2', 'after').toString());
  });
});
