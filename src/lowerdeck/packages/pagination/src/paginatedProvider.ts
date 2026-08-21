import { ServiceError, badRequestError } from '@lowerdeck/error';
import type { QueryFilter, SortOrder } from 'mongoose';
import { Cursor } from './cursor';
import type { PaginatedList } from './types';

export interface PaginatedProviderInput {
  limit: number;
  after?: string;
  before?: string;
  order: 'asc' | 'desc';
}

export interface PrismaPaginationOpts {
  orderBy: [{ id: 'asc' | 'desc' }];
  cursor?: { id: string };
  take: number;
  skip: number;
}

export interface MongoosePaginationOpts<T> {
  filter: QueryFilter<T>;
  sort: { _id: SortOrder };
  limit: number;
}

export type PaginatedProvider<T> = (
  input: PaginatedProviderInput
) => Promise<PaginatedList<T>>;

export type ExternalCursorPageInput = {
  cursor?: string;
  limit: number;
  direction: 'forward' | 'backward';
};

export type ExternalCursorPageResult<T> = {
  items: T[];
  nextCursor?: string;
  prevCursor?: string;
};

let resolveExternalCursor = (
  token: string,
  fallbackType: 'after' | 'before'
): { cursor: string; type: 'after' | 'before' } => {
  if (Cursor.isEncoded(token)) {
    let decoded = Cursor.fromString(token);
    return { cursor: decoded.id, type: decoded.type };
  }

  return { cursor: token, type: fallbackType };
};

export let paginatedProviderPrisma =
  <T extends { id: string }>(
    provider: (opts: PrismaPaginationOpts) => Promise<T[] | null | undefined>
  ): PaginatedProvider<T> =>
  async (input: PaginatedProviderInput) => {
    let { limit, after, before, order } = input;

    if (after && before) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot use both after and before cursors'
        })
      );
    }

    let opts: PrismaPaginationOpts = {
      orderBy: [{ id: order }],
      take: limit + 2,
      skip: 0
    };

    let cursorId = after ?? before;
    let cursorType: 'after' | 'before' | 'none' = 'none';

    if (after) {
      opts.cursor = { id: after };
      cursorType = 'after';
    } else if (before) {
      opts.cursor = { id: before };
      opts.take = -opts.take!;
      opts.skip = 0;
      cursorType = 'before';
    }

    let items = (await provider(opts)) ?? [];

    let orderedItems = items; /* items?.sort((a, b) => {
      if (order == 'asc') {
        return a.id.localeCompare(b.id);
      } else {
        return b.id.localeCompare(a.id);
      }
    });*/

    let cursorItem = cursorId ? orderedItems?.find(item => item.id == cursorId) : undefined;
    let cursorItemIndex = cursorItem ? orderedItems?.indexOf(cursorItem) : undefined;
    let orderedItemsWithoutCursor =
      typeof cursorItemIndex == 'number'
        ? [
            ...orderedItems.slice(0, cursorItemIndex),
            ...orderedItems.slice(cursorItemIndex + 1)
          ]
        : orderedItems;

    let selectedItems = orderedItemsWithoutCursor?.slice(0, limit);

    if (cursorType == 'before' && orderedItemsWithoutCursor.length > limit) {
      selectedItems = orderedItemsWithoutCursor?.slice(1, limit + 1);
    }

    let hasItemsBefore = false;
    let hasItemsAfter = false;

    if (cursorType == 'after' || cursorType == 'none') {
      if (orderedItemsWithoutCursor.length > selectedItems.length) hasItemsAfter = true;
      if (cursorItem) hasItemsBefore = true;
    } else if (cursorType == 'before') {
      if (orderedItemsWithoutCursor.length > selectedItems.length) hasItemsBefore = true;
      if (cursorItem) hasItemsAfter = true;
    }

    return {
      items: selectedItems,
      pagination: {
        hasNextPage: hasItemsAfter,
        hasPreviousPage: hasItemsBefore
      }
    };
  };

export let paginatedProviderMongoose =
  <T extends { _id: string }>(
    provider: (opts: MongoosePaginationOpts<T>) => Promise<T[] | null | undefined>
  ): PaginatedProvider<T> =>
  async (input: PaginatedProviderInput) => {
    let { limit, after, before, order } = input;

    if (after && before) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot use both after and before cursors'
        })
      );
    }

    let filter: QueryFilter<T> = {};
    let sort: { _id: SortOrder } = { _id: order === 'asc' ? 1 : -1 };
    let cursorId = after ?? before;
    let cursorType: 'after' | 'before' | 'none' = 'none';

    if (after) {
      filter._id = order === 'asc' ? { $gt: after } : { $lt: after };
      cursorType = 'after';
    } else if (before) {
      filter._id = order === 'asc' ? { $lt: before } : { $gt: before };
      sort._id = order === 'asc' ? -1 : 1;
      cursorType = 'before';
    }

    let opts: MongoosePaginationOpts<T> = {
      filter,
      sort,
      limit: limit + 1
    };

    let items = (await provider(opts)) ?? [];

    if (cursorType === 'before') items = items.reverse();

    let hasMore = items.length > limit;
    let selectedItems = hasMore ? items.slice(0, limit) : items;

    let hasItemsBefore = false;
    let hasItemsAfter = false;

    if (cursorType === 'after' || cursorType === 'none') {
      hasItemsAfter = hasMore;
      hasItemsBefore = !!after;
    } else if (cursorType === 'before') {
      hasItemsBefore = hasMore;
      hasItemsAfter = !!before;
    }

    return {
      items: selectedItems,
      pagination: {
        hasNextPage: hasItemsAfter,
        hasPreviousPage: hasItemsBefore
      }
    };
  };

export let paginatedProviderExternalCursor =
  <T>(
    fetch: (page: ExternalCursorPageInput) => Promise<ExternalCursorPageResult<T>>
  ): PaginatedProvider<T> =>
  async input => {
    let { limit, after, before } = input;

    if (after && before) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot use both after and before cursors'
        })
      );
    }

    let cursor: string | undefined;
    let direction: 'forward' | 'backward' = 'forward';

    if (after) {
      let resolved = resolveExternalCursor(after, 'after');
      cursor = resolved.cursor;
      direction = resolved.type === 'before' ? 'backward' : 'forward';
    } else if (before) {
      let resolved = resolveExternalCursor(before, 'before');
      cursor = resolved.cursor;
      direction = resolved.type === 'after' ? 'forward' : 'backward';
    }

    let page = await fetch({
      cursor,
      limit,
      direction
    });

    return {
      items: page.items,
      pagination: {
        hasNextPage: !!page.nextCursor,
        hasPreviousPage: !!page.prevCursor,
        after: page.nextCursor
          ? Cursor.fromId(page.nextCursor, 'after').toString()
          : undefined,
        before: page.prevCursor
          ? Cursor.fromId(page.prevCursor, 'before').toString()
          : undefined
      }
    };
  };
