export let autoPaginate = async <T>(
  cb: (cursor: { after?: string; limit?: number }) => Promise<{
    items: T[];
    pagination: {
      hasMoreAfter: boolean;
    };
  }>,
  getId: (item: T) => string = (item: any) => item.id,
  maxItems?: number
) => {
  let items: T[] = [];
  let after: string | undefined = undefined;
  let pageSize = 100;

  while (true) {
    let remaining = maxItems ? maxItems - items.length : pageSize;
    if (remaining <= 0) break;

    let { items: newItems, pagination } = await cb({
      after,
      limit: Math.min(pageSize, remaining)
    });

    items = [...items, ...newItems];
    let lastItem = newItems[newItems.length - 1];
    after = lastItem ? getId(lastItem) : undefined;

    if (
      !after ||
      !pagination.hasMoreAfter ||
      !items.length ||
      (maxItems && items.length >= maxItems)
    ) {
      break;
    }
  }

  return items;
};
