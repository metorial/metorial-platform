import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { RemotePage, RemotePageInput } from './remotePaginator';

// Pages a list held in memory, newest first, by the id of the item a page starts after or ends
// before, which is what the dashboard sends back.
export let pageByAnchor = <T extends { id: string }>(
  items: T[],
  page: RemotePageInput
): RemotePage<T> => {
  let ordered = page.order == 'asc' ? [...items].reverse() : items;
  let indexOf = (id: string) => {
    let index = ordered.findIndex(item => item.id == id);
    if (index < 0)
      throw new ServiceError(badRequestError({ message: 'Unknown list anchor.' }));

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
