type Lockfile = {
  workspaces: Record<
    string,
    {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    }
  >;
  packages: Record<string, any[]>;
};

export let restoreNestedResolutions = (source: Lockfile, pruned: Lockfile) => {
  let result = structuredClone(pruned);
  let lookup = { ...source.packages, ...pruned.packages };
  let names = Object.values(pruned.workspaces).flatMap(workspace =>
    workspace.name ? [workspace.name] : []
  );
  for (let [path, value] of Object.entries(source.packages)) {
    if (names.some(name => path.startsWith(name + '/'))) lookup[path] = value;
  }
  let parent = (path: string) => {
    let segments = path.split('/');
    segments.pop();
    if (segments.at(-1)?.startsWith('@')) segments.pop();
    return segments.join('/');
  };
  let find = (from: string, dependency: string) => {
    while (from) {
      let path = `${from}/${dependency}`;
      if (lookup[path]) return path;
      from = parent(from);
    }
    return lookup[dependency] ? dependency : undefined;
  };
  let pending: string[] = [];
  for (let workspace of Object.values(pruned.workspaces)) {
    for (let name of Object.keys({
      ...workspace.dependencies,
      ...workspace.devDependencies,
      ...workspace.optionalDependencies,
      ...workspace.peerDependencies
    })) {
      let path = find(workspace.name ?? '', name);
      if (path) pending.push(path);
    }
  }
  let visited = new Set<string>();
  while (pending.length) {
    let path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path);
    let value = lookup[path];
    if (value[0].includes('@workspace:')) continue;
    result.packages[path] = value;
    let metadata = value[2] ?? {};
    for (let name of Object.keys({
      ...metadata.dependencies,
      ...metadata.optionalDependencies,
      ...metadata.peerDependencies
    })) {
      let dependency = find(path, name);
      if (dependency) pending.push(dependency);
    }
  }
  return result;
};
