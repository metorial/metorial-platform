export let groupByKind = <Item extends { kind: string }>(items: readonly Item[]) => {
  let groups = new Map<Item['kind'], Item[]>();

  for (let item of items) {
    let group = groups.get(item.kind);
    if (group) group.push(item);
    else groups.set(item.kind, [item]);
  }

  return groups;
};
