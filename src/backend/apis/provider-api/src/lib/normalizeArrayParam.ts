export let normalizeArrayParam = (param: string | undefined): string[] | undefined => {
  if (!param) return undefined;
  let items = param.split(',').filter(Boolean);
  if (!items.length) return undefined;
  return items;
};

export let stringToBoolean = (str: string | undefined): boolean | undefined => {
  if (!str) return undefined;
  if (str === 'true') return true;
  if (str === 'false') return false;
  return undefined;
};
