export let MAX_CURSOR_ITEMS = 200;

export type PaginatedItemsResult<T> = {
  items: T[];
  truncated: boolean;
};

export let collectPaginatedItems = async <
  TItem,
  TPage extends { nextCursor?: string | undefined }
>(d: {
  fetchPage: (cursor?: string) => Promise<TPage>;
  getItems: (page: TPage) => TItem[];
}): Promise<PaginatedItemsResult<TItem>> => {
  let items: TItem[] = [];
  let cursor: string | undefined;
  let seenCursors = new Set<string>();
  let truncated = false;

  while (items.length < MAX_CURSOR_ITEMS) {
    let page = await d.fetchPage(cursor);
    let nextItems = d.getItems(page);
    let remaining = MAX_CURSOR_ITEMS - items.length;

    if (nextItems.length > remaining) {
      items.push(...nextItems.slice(0, remaining));
      truncated = true;
      break;
    }

    items.push(...nextItems);

    if (!page.nextCursor) {
      break;
    }

    if (seenCursors.has(page.nextCursor)) {
      truncated = true;
      break;
    }

    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }

  if (items.length >= MAX_CURSOR_ITEMS) {
    truncated = true;
  }

  return { items, truncated };
};
