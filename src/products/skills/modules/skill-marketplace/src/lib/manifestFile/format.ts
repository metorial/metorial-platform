import { compareManifestPaths, getManifestPathViolation } from './pathRules';
import { getManifestScopeViolation, type ManifestScope } from './scope';

export let manifestFormatVersion = 1;
export let manifestKind = 'metorial.skill-destination-manifest';

// Shared with Origin's syncManifest validation and the Go reader.
export let manifestFormatLimits = {
  maxEntries: 250_000,
  maxFileBytes: 2 * 1024 ** 3,
  maxLineBytes: 64 * 1024,
  maxObjectBytes: 96 * 1024 ** 2
};

export type ManifestHeader = {
  destinationId: string;
  sourceBucket: string;
  entryCount: number;
  totalBytes: number;
  scope: ManifestScope;
};

export type ManifestEntry = {
  path: string;
  gitBlobSha: string;
  sha256: string;
  size: number;
  crc32: number;
  key: string;
};

export class ManifestFileError extends Error {
  readonly code = 'manifest_invalid';

  constructor(
    message: string,
    readonly details: { line?: number; path?: string } = {}
  ) {
    super(details.line ? `${message} (line ${details.line})` : message);
    this.name = 'ManifestFileError';
  }
}

let gitShaPattern = /^[0-9a-f]{40}$/;
let sha256Pattern = /^[0-9a-f]{64}$/;
let maxEntryKeyBytes = 1024;
let encoder = new TextEncoder();

let isValidEntryKey = (key: unknown) =>
  typeof key == 'string' &&
  key.length > 0 &&
  encoder.encode(key).byteLength <= maxEntryKeyBytes &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(key) &&
  !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(key);

// Same ordering rules as the Go reader: strictly increasing in byte order, and no path may be
// both a file and a directory ("a" and "a/b").
export class ManifestPathOrder {
  private previous: string | undefined;
  private pendingFiles: string[] = [];

  add(path: string, line?: number) {
    if (this.previous !== undefined) {
      let order = compareManifestPaths(this.previous, path);
      if (order >= 0) {
        throw new ManifestFileError(
          order === 0 ? 'Duplicate manifest path' : 'Manifest entries must be sorted by path',
          { line, path }
        );
      }
    }

    let kept: string[] = [];
    for (let file of this.pendingFiles) {
      if (path.startsWith(`${file}/`)) {
        throw new ManifestFileError(`"${file}" is both a file and a directory`, {
          line,
          path
        });
      }

      // '0' sorts right after '/', so no later path can start with `${file}/`.
      if (compareManifestPaths(path, `${file}0`) < 0) kept.push(file);
    }

    kept.push(path);
    this.pendingFiles = kept;
    this.previous = path;
  }
}

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value == 'object' && value !== null && !Array.isArray(value);

let isNonEmptyString = (value: unknown): value is string =>
  typeof value == 'string' && value.length > 0;

let isIntegerInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value == 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

let isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item == 'string');

let assertKeys = (value: Record<string, unknown>, keys: string[], line: number) => {
  let unknown = Object.keys(value).find(key => !keys.includes(key));
  if (unknown) throw new ManifestFileError(`Unknown field "${unknown}"`, { line });
};

export let encodeManifestHeader = (header: ManifestHeader) =>
  JSON.stringify({
    t: 'header',
    v: manifestFormatVersion,
    kind: manifestKind,
    destinationId: header.destinationId,
    sourceBucket: header.sourceBucket,
    entryCount: header.entryCount,
    totalBytes: header.totalBytes,
    scope: { dirs: header.scope.dirs, files: header.scope.files, globs: header.scope.globs }
  });

export let encodeManifestEntry = (entry: ManifestEntry) =>
  JSON.stringify({
    t: 'entry',
    p: entry.path,
    g: entry.gitBlobSha,
    s: entry.sha256,
    n: entry.size,
    c: entry.crc32,
    k: entry.key
  });

export let validateManifestHeader = (header: ManifestHeader, line = 1) => {
  if (!isNonEmptyString(header.destinationId)) {
    throw new ManifestFileError('Header destinationId must be a non-empty string', { line });
  }
  if (!isNonEmptyString(header.sourceBucket)) {
    throw new ManifestFileError('Header sourceBucket must be a non-empty string', { line });
  }
  if (!isIntegerInRange(header.entryCount, 0, manifestFormatLimits.maxEntries)) {
    throw new ManifestFileError(
      `Header entryCount must be an integer between 0 and ${manifestFormatLimits.maxEntries}`,
      { line }
    );
  }
  if (!isIntegerInRange(header.totalBytes, 0, Number.MAX_SAFE_INTEGER)) {
    throw new ManifestFileError('Header totalBytes must be a non-negative integer', { line });
  }

  let scope = header.scope as unknown;
  if (
    !isRecord(scope) ||
    !isStringArray(scope.dirs) ||
    !isStringArray(scope.files) ||
    !isStringArray(scope.globs)
  ) {
    throw new ManifestFileError('Header scope must have dirs, files and globs arrays', {
      line
    });
  }

  let scopeViolation = getManifestScopeViolation(header.scope);
  if (scopeViolation) {
    throw new ManifestFileError(
      `Scope ${scopeViolation.kind} entry is invalid: ${scopeViolation.violation}`,
      { line, path: scopeViolation.value }
    );
  }
};

export let validateManifestEntry = (entry: ManifestEntry, line?: number) => {
  let pathViolation =
    typeof entry.path == 'string' ? getManifestPathViolation(entry.path) : 'empty';
  if (pathViolation) {
    throw new ManifestFileError(`Entry path is invalid: ${pathViolation}`, {
      line,
      path: String(entry.path)
    });
  }

  let details = { line, path: entry.path };
  if (typeof entry.gitBlobSha != 'string' || !gitShaPattern.test(entry.gitBlobSha)) {
    throw new ManifestFileError('Entry git blob SHA must be 40 lowercase hex digits', details);
  }
  if (typeof entry.sha256 != 'string' || !sha256Pattern.test(entry.sha256)) {
    throw new ManifestFileError('Entry sha256 must be 64 lowercase hex digits', details);
  }
  if (!isIntegerInRange(entry.size, 0, manifestFormatLimits.maxFileBytes)) {
    throw new ManifestFileError(
      `Entry size must be an integer between 0 and ${manifestFormatLimits.maxFileBytes}`,
      details
    );
  }
  if (!isIntegerInRange(entry.crc32, 0, 0xffffffff)) {
    throw new ManifestFileError('Entry crc32 must be an unsigned 32-bit integer', details);
  }
  if (!isValidEntryKey(entry.key)) {
    throw new ManifestFileError(
      `Entry key must be a non-empty object key of at most ${maxEntryKeyBytes} bytes`,
      details
    );
  }
};

export let parseManifestHeaderLine = (text: string, line: number): ManifestHeader => {
  let value = parseJsonLine(text, line);
  if (value.t !== 'header')
    throw new ManifestFileError('First line must be the header', { line });

  assertKeys(
    value,
    ['t', 'v', 'kind', 'destinationId', 'sourceBucket', 'entryCount', 'totalBytes', 'scope'],
    line
  );
  if (value.v !== manifestFormatVersion) {
    throw new ManifestFileError(`Unsupported manifest version ${String(value.v)}`, { line });
  }
  if (value.kind !== manifestKind) {
    throw new ManifestFileError(`Unexpected manifest kind ${String(value.kind)}`, { line });
  }

  let header = {
    destinationId: value.destinationId,
    sourceBucket: value.sourceBucket,
    entryCount: value.entryCount,
    totalBytes: value.totalBytes,
    scope: value.scope
  } as ManifestHeader;
  validateManifestHeader(header, line);

  if (isRecord(value.scope)) assertKeys(value.scope, ['dirs', 'files', 'globs'], line);

  return header;
};

export let parseManifestEntryLine = (text: string, line: number): ManifestEntry => {
  let value = parseJsonLine(text, line);
  if (value.t !== 'entry') throw new ManifestFileError('Expected an entry line', { line });

  assertKeys(value, ['t', 'p', 'g', 's', 'n', 'c', 'k'], line);

  let entry = {
    path: value.p,
    gitBlobSha: value.g,
    sha256: value.s,
    size: value.n,
    crc32: value.c,
    key: value.k
  } as ManifestEntry;
  validateManifestEntry(entry, line);

  return entry;
};

let parseJsonLine = (text: string, line: number) => {
  if (!text.startsWith('{') || !text.endsWith('}')) {
    throw new ManifestFileError('Line must be a JSON object without surrounding whitespace', {
      line
    });
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ManifestFileError('Line is not valid JSON', { line });
  }

  if (!isRecord(value)) throw new ManifestFileError('Line must be a JSON object', { line });
  return value;
};
