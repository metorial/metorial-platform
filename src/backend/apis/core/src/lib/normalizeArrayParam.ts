export let normalizeArrayParam = <T>(param: T | T[] | undefined) => {
  let items = (Array.isArray(param) ? param : [param!]).filter(Boolean);
  if (!items.length) return undefined;

  return items;
};
