import { badRequestError, ServiceError } from '@lowerdeck/error';

export type StorePathKind = 'file' | 'directory';

export type NormalizedStorePath = {
  kind: StorePathKind;
  path: string;
  name: string | null;
  parentPath: string | null;
  segments: string[];
};

let allowedStorePathCharacter = /^[A-Za-z0-9._() \-$]$/;
let dotOnlySegmentPattern = /^\.+$/;

let normalizeStorePathSegment = (segment: string) => {
  let normalized = Array.from(segment.trim())
    .filter(character => allowedStorePathCharacter.test(character))
    .join('');

  if (!normalized) return null;
  if (dotOnlySegmentPattern.test(normalized)) return null;

  return normalized;
};

let buildStorePath = (segments: string[], kind: StorePathKind) => {
  if (kind === 'directory') {
    if (segments.length === 0) return '/';

    return `/${segments.join('/')}/`;
  }

  return `/${segments.join('/')}`;
};

let buildParentDirectoryPath = (segments: string[], kind: StorePathKind) => {
  if (kind === 'directory') {
    if (segments.length === 0) return null;
    if (segments.length === 1) return '/';

    return `/${segments.slice(0, -1).join('/')}/`;
  }

  if (segments.length <= 1) return '/';

  return `/${segments.slice(0, -1).join('/')}/`;
};

export let normalizeStorePath = (d: {
  path: string | undefined;
  kind: StorePathKind;
}): NormalizedStorePath => {
  if (!d.path) {
    throw new ServiceError(
      badRequestError({
        message: 'Store item path is required'
      })
    );
  }

  let trimmed = d.path.trim();
  if (!trimmed) {
    throw new ServiceError(
      badRequestError({
        message: 'Store item path cannot be empty'
      })
    );
  }

  let normalizedInput = trimmed.replaceAll('\\', '/');
  let segments = normalizedInput
    .split('/')
    .map(normalizeStorePathSegment)
    .filter((segment): segment is string => !!segment);

  if (d.kind === 'file' && segments.length === 0) {
    throw new ServiceError(
      badRequestError({
        message: 'Store file paths must include a file name'
      })
    );
  }

  return {
    kind: d.kind,
    path: buildStorePath(segments, d.kind),
    name: segments.length > 0 ? segments[segments.length - 1]! : null,
    parentPath: buildParentDirectoryPath(segments, d.kind),
    segments
  };
};

export let listAncestorDirectoryPaths = (
  path: NormalizedStorePath,
  d?: { includeSelf?: boolean }
) => {
  let directories = ['/'];

  if (path.segments.length === 0) {
    return d?.includeSelf ? directories : [];
  }

  let limit = path.kind === 'directory' ? path.segments.length : path.segments.length - 1;
  for (let index = 0; index < limit; index++) {
    directories.push(`/${path.segments.slice(0, index + 1).join('/')}/`);
  }

  if (!d?.includeSelf && path.kind === 'directory') {
    return directories.slice(0, -1);
  }

  return directories;
};
