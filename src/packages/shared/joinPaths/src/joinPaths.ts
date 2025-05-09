export let joinPaths = (...paths: (string | null | undefined)[]) => {
  return `/${paths
    .filter(Boolean)
    .map(path => path!.replace(/(^\/+|\/+$)/g, ''))
    .filter(path => path.length > 0)
    .join('/')}`;
};
