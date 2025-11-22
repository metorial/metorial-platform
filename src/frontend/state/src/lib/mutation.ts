export let mutation = async <T>(cb: () => Promise<T>) => {
  try {
    let res = await cb();
    return [res, null] as const;
  } catch (err) {
    return [null, err as Error] as const;
  }
};
