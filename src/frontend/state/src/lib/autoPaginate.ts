export let autoPaginate = async <T extends { id: string }>(
  cb: (cursor: { after?: string }) => Promise<{
    items: T[];
    pagination: {
      hasMoreAfter: boolean;
    };
  }>
) => {
  let items: T[] = [];
  let after: string | undefined = undefined;

  while (true) {
    let { items: newItems, pagination } = await cb({ after });

    items = [...items, ...newItems];
    after = newItems[newItems.length - 1]?.id;

    if (!after || !pagination.hasMoreAfter || !items.length) break;
  }

  return items;
};
