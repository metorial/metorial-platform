export let joinPaths = (...paths: (string | null | undefined | object)[]) => {
  let path = `/${paths
    .filter(p => Boolean(p) && typeof p != 'object')
    .map(path => (path as string)!.replace(/(^\/+|\/+$)/g, ''))
    .filter(path => path.length > 0)
    .join('/')}`;

  let search: Record<string, string> = {};
  for (let path of paths) {
    if (path && typeof path == 'object') {
      for (let [key, value] of Object.entries(path)) {
        if (value !== undefined && value !== null) search[key] = String(value);
      }
    }
  }

  if (Object.keys(search).length > 0) {
    path += '?' + new URLSearchParams(search).toString();
  }

  return path;
};
