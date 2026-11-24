import { invalidInputError } from './errors';
import type { RemotePage, RemotePageInput } from './remotePaginator';

export let pageByAnchor = <T extends { id: string }>(
  items: T[],
  page: RemotePageInput
): RemotePage<T> => {
  let ordered = page.order == 'asc' ? [...items].reverse() : items;
  let indexOf = (id: string) => {
    let index = ordered.findIndex(item => item.id == id);
    if (index < 0) throw invalidInputError('Unknown list anchor.');

    return index;
  };

  let start =
    page.before !== undefined
      ? Math.max(0, indexOf(page.before) - page.limit)
      : page.after !== undefined
        ? indexOf(page.after) + 1
        : 0;
  let end =
    page.before !== undefined
      ? indexOf(page.before)
      : Math.min(ordered.length, start + page.limit);

  let slice = ordered.slice(start, end);

  return {
    items: slice,
    hasMoreAfter: end < ordered.length,
    hasMoreBefore: start > 0,
    after: slice.at(-1)?.id,
    before: slice[0]?.id
  };
};
