export let uniqueBy = <T>(arr: T[], key: (item: T) => string | number) => {
  let seen = new Set<string | number>();
  let result: T[] = [];
  for (let item of arr) {
    let k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(item);
    }
  }
  return result;
};
