type ConsumerAuthorization = {
  id: string;
  createdAt: Date;
};

export type CursorPage = {
  order: 'asc' | 'desc';
  cursor?: string;
  limit: number;
  direction: 'forward' | 'backward';
};

export let sortAuthorizations = <T extends ConsumerAuthorization>(items: T[]) =>
  [...items].sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );

export let pageAuthorizations = <T extends ConsumerAuthorization>(
  newestFirst: T[],
  page: CursorPage
) => {
  let items = page.order == 'desc' ? newestFirst : [...newestFirst].reverse();
  let cursorIndex = page.cursor ? items.findIndex(item => item.id == page.cursor) : -1;

  let start = 0;
  let end = Math.min(page.limit, items.length);

  if (page.cursor && cursorIndex >= 0) {
    if (page.direction == 'forward') {
      start = cursorIndex + 1;
      end = Math.min(start + page.limit, items.length);
    } else {
      end = cursorIndex;
      start = Math.max(0, end - page.limit);
    }
  }

  let selected = items.slice(start, end);

  return {
    items: selected,
    nextCursor: end < items.length ? selected[selected.length - 1]?.id : undefined,
    prevCursor: start > 0 ? selected[0]?.id : undefined
  };
};
