import type { FileEntry } from '../types';

export type FileSortKey = 'name' | 'size' | 'modified';
export type FileSortDirection = 'asc' | 'desc';

export interface FileSort {
  key: FileSortKey;
  direction: FileSortDirection;
}

export let DEFAULT_FILE_SORT: FileSort = { key: 'name', direction: 'asc' };

let collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export let isDirectoryLike = (entry: Pick<FileEntry, 'type' | 'targetType'>) =>
  entry.type == 'directory' || (entry.type == 'symlink' && entry.targetType == 'directory');

let compareNames = (a: FileEntry, b: FileEntry) =>
  collator.compare(a.name, b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

let compareByKey = (a: FileEntry, b: FileEntry, key: FileSortKey) => {
  if (key == 'size' && !isDirectoryLike(a)) return a.size - b.size;

  if (key == 'modified') {
    let aTime = a.modifiedAt?.getTime() ?? 0;
    let bTime = b.modifiedAt?.getTime() ?? 0;

    return aTime - bTime;
  }

  return 0;
};

export let sortEntries = (entries: FileEntry[], sort: FileSort = DEFAULT_FILE_SORT) => {
  let factor = sort.direction == 'asc' ? 1 : -1;

  return [...entries].sort((a, b) => {
    let aDir = isDirectoryLike(a);
    let bDir = isDirectoryLike(b);
    if (aDir != bDir) return aDir ? -1 : 1;

    let primary = compareByKey(a, b, sort.key);
    if (primary != 0) return primary * factor;

    return compareNames(a, b) * (sort.key == 'name' ? factor : 1);
  });
};

export let isHiddenEntry = (entry: Pick<FileEntry, 'name'>) => entry.name.startsWith('.');

export let filterHiddenEntries = (entries: FileEntry[], showHidden: boolean) =>
  showHidden ? entries : entries.filter(entry => !isHiddenEntry(entry));

export let toggleSort = (current: FileSort, key: FileSortKey): FileSort => {
  if (current.key == key) {
    return { key, direction: current.direction == 'asc' ? 'desc' : 'asc' };
  }

  return { key, direction: key == 'name' ? 'asc' : 'desc' };
};
