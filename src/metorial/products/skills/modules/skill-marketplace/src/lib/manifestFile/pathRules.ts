export let maxManifestPathBytes = 4096;
export let maxManifestPathSegmentBytes = 255;

export type ManifestPathViolation =
  | 'empty'
  | 'absolute'
  | 'invalid_utf8'
  | 'control_character'
  | 'backslash'
  | 'not_nfc'
  | 'path_too_long'
  | 'empty_segment'
  | 'dot_segment'
  | 'segment_too_long'
  | 'git_dir'
  | 'git_metadata_file';

let encoder = new TextEncoder();

let loneSurrogatePattern =
  /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

let controlCharacterPattern = /[\u0000-\u001f\u007f-\u009f]/;

let byteLength = (value: string) => encoder.encode(value).byteLength;

// Only A-Z is folded, matching Go's pkg/manifest, so `ſ` or `İ` never turn into git names.
let asciiLower = (value: string) => value.replace(/[A-Z]/g, c => c.toLowerCase());

let getGitSegmentViolation = (segment: string): ManifestPathViolation | null => {
  let lower = asciiLower(segment);
  if (lower === '.git') return 'git_dir';
  if (lower === '.gitattributes' || lower === '.gitmodules') return 'git_metadata_file';
  return null;
};

let getSegmentViolation = (segment: string): ManifestPathViolation | null => {
  if (segment === '') return 'empty_segment';
  if (segment === '.' || segment === '..') return 'dot_segment';
  if (byteLength(segment) > maxManifestPathSegmentBytes) return 'segment_too_long';
  return getGitSegmentViolation(segment);
};

// Shared with Origin's pkg/manifest (fixture: code-bucket/pkg/manifest/testdata/path-rules.json).
// The checks run in the same order so both report the same reason for a path that breaks
// several rules.
export let getManifestPathViolation = (path: string): ManifestPathViolation | null => {
  if (path === '') return 'empty';
  if (path.startsWith('/')) return 'absolute';
  if (loneSurrogatePattern.test(path)) return 'invalid_utf8';
  if (controlCharacterPattern.test(path)) return 'control_character';
  if (path.includes('\\')) return 'backslash';
  if (path.normalize('NFC') !== path) return 'not_nfc';
  if (byteLength(path) > maxManifestPathBytes) return 'path_too_long';

  for (let segment of path.split('/')) {
    let violation = getSegmentViolation(segment);
    if (violation) return violation;
  }

  return null;
};

export let isValidManifestPath = (path: string) => getManifestPathViolation(path) === null;

export let hasGitReservedSegment = (path: string) =>
  path.split('/').some(segment => getGitSegmentViolation(segment) !== null);

export let normalizeManifestPath = (path: string) => {
  let normalized = path.normalize('NFC').replace(/^\/+/, '');
  return { path: normalized, violation: getManifestPathViolation(normalized) };
};

// UTF-8 byte order, which is code point order. Plain `<` compares UTF-16 code units and puts
// astral characters (surrogate pairs) before U+E000..U+FFFF.
export let compareManifestPaths = (a: string, b: string) => {
  let length = Math.min(a.length, b.length);

  for (let i = 0; i < length; i++) {
    let x = a.charCodeAt(i);
    let y = b.charCodeAt(i);
    if (x === y) continue;

    let xIsSurrogate = x >= 0xd800 && x <= 0xdfff;
    let yIsSurrogate = y >= 0xd800 && y <= 0xdfff;
    if (xIsSurrogate !== yIsSurrogate) return xIsSurrogate ? 1 : -1;

    return x - y;
  }

  return a.length - b.length;
};

// Allowed, but checkouts on case-insensitive file systems would clash, so callers log them.
export let findCaseInsensitivePathCollisions = (paths: Iterable<string>) => {
  let seen = new Map<string, string>();
  let collisions: [string, string][] = [];

  for (let path of paths) {
    let folded = path.toLowerCase();
    let existing = seen.get(folded);

    if (existing === undefined) seen.set(folded, path);
    else if (existing !== path) collisions.push([existing, path]);
  }

  return collisions;
};
