export type DateFilter = {
  gt?: Date;
  lt?: Date;
};

export let normalizeDateFilter = (filter?: DateFilter) => {
  if (!filter) return undefined;

  let where: { gt?: Date; lt?: Date } = {};

  if (filter.gt) where.gt = filter.gt;
  if (filter.lt) where.lt = filter.lt;

  if (!where.gt && !where.lt) return undefined;

  return where;
};
