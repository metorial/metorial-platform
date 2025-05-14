export let normalizeArrayParam = <T>(param: T | T[] | undefined) => {
  if (param === undefined) undefined;

  if (Array.isArray(param)) return param;
  return [param!];
};
