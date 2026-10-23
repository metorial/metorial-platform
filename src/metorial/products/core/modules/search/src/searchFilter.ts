export let buildSearchFilter = async <Where>(d: {
  search: string | null | undefined;
  findIds: (query: string) => Promise<string[] | null | undefined>;
  matchIds?: (ids: string[]) => Where;
  exact?: (query: string) => Where[];
}): Promise<{ OR: Where[] } | undefined> => {
  let query = d.search?.trim();
  if (!query) return undefined;

  let ids: string[] | null | undefined = null;
  try {
    ids = await d.findIds(query);
  } catch (error) {
    console.error('[module-search] Search lookup failed, using exact matches only', error);
  }

  let hits = ids?.length
    ? [d.matchIds ? d.matchIds(ids) : ({ id: { in: ids } } as Where)]
    : [];
  let exact = d.exact ? d.exact(query) : [{ id: query } as Where];

  return { OR: [...hits, ...exact] };
};
