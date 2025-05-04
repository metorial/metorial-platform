import { ServiceError, badRequestError } from '@metorial/error';
import { Cursor } from './cursor';
import { PaginatedList } from './types';

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

export type PaginatedProvider<T> = (
  input: PaginatedProviderInput
) => Promise<PaginatedList<T>>;

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

    if (after) {
      opts.cursor = { id: after };
    } else if (before) {
      opts.cursor = { id: before };
      opts.take = -opts.take!;
    }

    let items = (await provider(opts)) ?? [];

    let orderedItems = items?.sort((a, b) => {
      if (order == 'asc') {
        return a.id.localeCompare(b.id);
      } else {
        return b.id.localeCompare(a.id);
      }
    });

    let cursorItem = cursorId ? orderedItems?.find(item => item.id == cursorId) : undefined;
    let cursorItemIndex = cursorItem ? orderedItems?.indexOf(cursorItem) : undefined;
    let orderedItemsWithoutCursor = cursorItemIndex
      ? [...orderedItems.slice(0, cursorItemIndex), ...orderedItems.slice(cursorItemIndex + 1)]
      : orderedItems;

    let selectedItems = orderedItemsWithoutCursor?.slice(0, limit);

    let beforeCursor: string | undefined = undefined;
    let afterCursor: string | undefined = undefined;

    if (selectedItems?.length) {
      if (order == 'asc') {
        afterCursor = selectedItems[selectedItems.length - 1].id;
        beforeCursor = selectedItems[0].id;
      } else {
        afterCursor = selectedItems[0].id;
        beforeCursor = selectedItems[selectedItems.length - 1].id;
      }
    }

    return {
      items: selectedItems,
      pagination: {
        hasNextPage: selectedItems?.length == limit,
        hasPreviousPage: !!beforeCursor,
        beforeCursor: beforeCursor ? Cursor.fromId(beforeCursor, 'before').toString() : null,
        afterCursor: afterCursor ? Cursor.fromId(afterCursor, 'after').toString() : null
      }
    };
  };
