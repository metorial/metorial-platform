import { getManifestPathViolation, hasGitReservedSegment } from './pathRules';

export type ManifestScope = {
  dirs: string[];
  files: string[];
  globs: string[];
};

let matchSegment = (pattern: string, segment: string) => {
  let parts = pattern.split('*');
  if (parts.length === 1) return pattern === segment;

  let first = parts[0]!;
  if (!segment.startsWith(first)) return false;
  let rest = segment.slice(first.length);

  for (let part of parts.slice(1, -1)) {
    let at = rest.indexOf(part);
    if (at < 0) return false;
    rest = rest.slice(at + part.length);
  }

  let last = parts[parts.length - 1]!;
  return rest.length >= last.length && rest.endsWith(last);
};

let matchGlob = (glob: string, path: string) => {
  let globSegments = glob.split('/');
  let pathSegments = path.split('/');
  if (globSegments.length !== pathSegments.length) return false;

  return globSegments.every((pattern, i) => matchSegment(pattern, pathSegments[i]!));
};

// Mirrors Scope.Contains in Origin's pkg/manifest: dirs match everything below them, files
// match exactly, and `*` in a glob matches within one segment. Paths with .git, .gitattributes
// or .gitmodules segments are never in scope, so scope deletes can't touch repository metadata.
export let scopeContains = (scope: ManifestScope, path: string) => {
  if (path === '' || hasGitReservedSegment(path)) return false;

  return (
    scope.files.includes(path) ||
    scope.dirs.some(dir => path.startsWith(`${dir}/`)) ||
    scope.globs.some(glob => matchGlob(glob, path))
  );
};

export let getManifestScopeViolation = (scope: ManifestScope) => {
  for (let [kind, values] of [
    ['dirs', scope.dirs],
    ['files', scope.files],
    ['globs', scope.globs]
  ] as const) {
    for (let value of values) {
      let violation = getManifestPathViolation(value);
      if (violation) return { kind, value, violation };
    }
  }

  return null;
};
