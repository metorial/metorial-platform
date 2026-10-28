export let searchTaxonomyWhere = (search: string) => ({
  OR: [
    { name: { contains: search, mode: 'insensitive' as const } },
    { slug: { contains: search, mode: 'insensitive' as const } },
    { description: { contains: search, mode: 'insensitive' as const } }
  ]
});
