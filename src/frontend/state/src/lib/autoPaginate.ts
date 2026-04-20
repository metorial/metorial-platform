export let autoPaginate = async <T>(
  cb: (cursor: { after?: string; limit?: number }) => Promise<{
    items: T[];
    pagination: {
      hasMoreAfter: boolean;
    };
  }>,
  getId: (item: T) => string = (item: any) => item.id
) => {
  let items: T[] = [];
  let after: string | undefined = undefined;

  while (true) {
    let { items: newItems, pagination } = await cb({ after, limit: 100 });

    items = [...items, ...newItems];
    let lastItem = newItems[newItems.length - 1];
    after = lastItem ? getId(lastItem) : undefined;

    if (!after || !pagination.hasMoreAfter || !items.length) break;
  }

  return items;
};
