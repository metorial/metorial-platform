import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { StorePathMode } from '@metorial/db';

export type StorePathKind = 'file' | 'directory';

export type NormalizedStorePath = {
  kind: StorePathKind;
  path: string;
  name: string | null;
  parentPath: string | null;
  segments: string[];
};

let legacyAllowedStorePathCharacter = /^[A-Za-z0-9._() \-$]$/;
// Characters some filesystem refuses, '#' and '%' (code-bucket object keys built with older
// object-storage clients treat them as URL syntax), invisible/control characters, and whitespace
// other than a plain space. U+200D stays allowed because joined emoji sequences depend on it.
let unicodeDisallowedStorePathCharacter =
  /^(?:[\\/:*?"<>|#%\p{Cc}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}]|(?!\u200d)\p{Cf}|(?! )\p{Zs})$/u;
let dotOnlySegmentPattern = /^\.+$/;

let describeCharacter = (character: string) => {
  let codePoint = character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');

  return `${JSON.stringify(character)} (U+${codePoint})`;
};

let normalizeLegacySegment = (segment: string) =>
  Array.from(segment.trim())
    .filter(character => legacyAllowedStorePathCharacter.test(character))
    .join('');

let normalizeUnicodeSegment = (segment: string) => {
  let normalized = segment.trim().normalize('NFC');

  let disallowedCharacter = Array.from(normalized).find(character =>
    unicodeDisallowedStorePathCharacter.test(character)
  );
  if (disallowedCharacter) {
    throw new ServiceError(
      badRequestError({
        message: `Store item path contains a character that is not allowed: ${describeCharacter(disallowedCharacter)}`
      })
    );
  }

  return normalized;
};

export let stripDisallowedStorePathCharacters = (path: string) =>
  Array.from(path.normalize('NFC'))
    .filter(
      character => character === '/' || !unicodeDisallowedStorePathCharacter.test(character)
    )
    .join('');

let normalizeStorePathSegment = (segment: string, mode: StorePathMode) => {
  let normalized =
    mode === 'unicode' ? normalizeUnicodeSegment(segment) : normalizeLegacySegment(segment);

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
  mode: StorePathMode;
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
    .map(segment => normalizeStorePathSegment(segment, d.mode))
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
