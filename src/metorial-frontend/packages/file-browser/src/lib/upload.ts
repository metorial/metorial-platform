import type { FileEntry } from '../types';

export interface UploadTarget {
  directory: string;
  overwrite: boolean;
}

export let partitionUploads = (files: File[], existing: Pick<FileEntry, 'name'>[]) => {
  let names = new Set(existing.map(entry => entry.name));
  let fresh: File[] = [];
  let conflicting: File[] = [];

  for (let file of files) {
    if (names.has(file.name)) conflicting.push(file);
    else fresh.push(file);
  }

  return { fresh, conflicting };
};

export let describeUploadDirectory = (items: { meta?: { directory: string } }[]) => {
  let directories = new Set<string>();

  for (let item of items) {
    if (item.meta) directories.add(item.meta.directory);
  }

  if (directories.size != 1) return null;

  let [directory] = Array.from(directories);
  return directory!;
};

export let summarizeNames = (names: string[], limit = 3) => {
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} and ${names.length - limit} more`;
};
