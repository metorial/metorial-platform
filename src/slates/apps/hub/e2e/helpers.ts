export let listAll = async <T>(
  fetchPage: (page: { limit: number; after?: string }) => Promise<{
    items: (T & { id: string })[];
    pagination: { has_more_after: boolean };
  }>
) => {
  let items: (T & { id: string })[] = [];
  let after: string | undefined;

  while (true) {
    let page = await fetchPage({ limit: 100, after });
    items.push(...page.items);

    if (!page.pagination.has_more_after || page.items.length == 0) return items;
    after = page.items[page.items.length - 1]!.id;
  }
};
