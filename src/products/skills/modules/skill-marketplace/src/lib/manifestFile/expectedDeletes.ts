import { ManifestFileError } from './format';
import { compareManifestPaths } from './pathRules';

type PathSource = Iterable<{ path: string }> | AsyncIterable<{ path: string }>;

let sortedPaths = async function* (source: PathSource) {
  let previous: string | undefined;

  for await (let { path } of source) {
    if (previous !== undefined && compareManifestPaths(previous, path) >= 0) {
      throw new ManifestFileError('Manifest entries must be sorted by path', { path });
    }

    previous = path;
    yield path;
  }
};

// Merge-join of two path-sorted manifests in constant memory: the paths of `previous` that
// `current` no longer has.
export let expectedDeletes = async function* (previous: PathSource, current: PathSource) {
  let currentPaths = sortedPaths(current);
  let next = await currentPaths.next();

  for await (let path of sortedPaths(previous)) {
    while (!next.done && compareManifestPaths(next.value, path) < 0) {
      next = await currentPaths.next();
    }

    if (next.done || next.value !== path) yield path;
  }
};
