export let groupBy = <T, K extends keyof T, V extends T[K]>(arr: T[], key: K): Map<V, T[]> => {
  let map = new Map<V, T[]>();

  for (let item of arr) {
    let groupKey = item[key] as V;
    let group = map.get(groupKey);
    if (!group) {
      group = [];
      map.set(groupKey, group);
    }
    group.push(item);
  }

  return map;
};
