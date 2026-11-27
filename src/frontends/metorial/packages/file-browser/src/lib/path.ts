export let ROOT_PATH = '/';

export let normalizePath = (path: string | null | undefined) => {
  let parts: string[] = [];

  for (let part of (path ?? '').split('/')) {
    if (!part || part == '.') continue;

    if (part == '..') parts.pop();
    else parts.push(part);
  }

  return `/${parts.join('/')}`;
};

export let joinPath = (base: string, ...parts: string[]) => {
  let result = base;

  for (let part of parts) {
    if (!part) continue;
    result = part.startsWith('/') ? part : `${result}/${part}`;
  }

  return normalizePath(result);
};

export let dirname = (path: string) => {
  let normalized = normalizePath(path);
  let index = normalized.lastIndexOf('/');

  return index <= 0 ? ROOT_PATH : normalized.slice(0, index);
};

export let basename = (path: string) => {
  let normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
};

export let extname = (path: string) => {
  let name = basename(path);
  let index = name.lastIndexOf('.');

  return index <= 0 ? '' : name.slice(index).toLowerCase();
};

export let isRootPath = (path: string) => normalizePath(path) == ROOT_PATH;

export let isSameOrDescendant = (path: string, ancestor: string) => {
  let normalizedPath = normalizePath(path);
  let normalizedAncestor = normalizePath(ancestor);

  if (normalizedAncestor == ROOT_PATH) return true;

  return (
    normalizedPath == normalizedAncestor || normalizedPath.startsWith(`${normalizedAncestor}/`)
  );
};

export let replacePathPrefix = (path: string, from: string, to: string) => {
  let normalizedPath = normalizePath(path);
  let normalizedFrom = normalizePath(from);

  if (!isSameOrDescendant(normalizedPath, normalizedFrom)) return normalizedPath;
  if (normalizedFrom == ROOT_PATH) return joinPath(to, normalizedPath);

  return normalizePath(`${to}${normalizedPath.slice(normalizedFrom.length)}`);
};

export let getAncestorPaths = (path: string) => {
  let normalized = normalizePath(path);
  let ancestors = [ROOT_PATH];
  let current = '';

  for (let part of normalized.split('/').filter(Boolean)) {
    current = `${current}/${part}`;
    ancestors.push(current);
  }

  return ancestors;
};

export interface PathSegment {
  name: string;
  path: string;
}

export let getPathSegments = (path: string): PathSegment[] =>
  getAncestorPaths(path).map(ancestor => ({
    name: ancestor == ROOT_PATH ? ROOT_PATH : basename(ancestor),
    path: ancestor
  }));

export let validateEntryName = (name: string) => {
  let trimmed = name.trim();

  if (!trimmed) return 'Enter a name.';
  if (trimmed == '.' || trimmed == '..') return `"${trimmed}" isn't a valid name.`;
  if (trimmed.includes('/')) return 'Names can’t contain "/".';
  if (trimmed.includes('\0')) return 'Names can’t contain null characters.';
  if (new TextEncoder().encode(trimmed).length > 255) return 'Names can be at most 255 bytes.';

  return null;
};

export let hasHiddenSegment = (path: string) =>
  normalizePath(path)
    .split('/')
    .some(segment => segment.startsWith('.'));
