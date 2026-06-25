export let normalizePath = (path: string) => {
  if (!path) return '/';

  let segments = path.split('/').filter(segment => segment && segment !== '.');
  let normalized: string[] = [];

  for (let segment of segments) {
    if (segment === '..') {
      // Remove last segment if it exists (go up one directory)
      normalized.pop();
    } else {
      normalized.push(segment);
    }
  }

  let result = '/' + normalized.join('/');

  return result === '/' ? '/' : result;
};
