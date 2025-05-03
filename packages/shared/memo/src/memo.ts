export let memo = <Func extends (...args: any[]) => any>(func: Func) => {
  let cache: {
    args: Parameters<Func>;
    result: ReturnType<Func>;
  }[] = [];

  return (...args: Parameters<Func>): ReturnType<Func> => {
    let cached = cache.find(c => c.args.every((arg, i) => arg === args[i]));

    if (cached) {
      return cached.result;
    } else {
      let result = func(...args);

      cache.push({
        args,
        result
      });

      return result;
    }
  };
};
