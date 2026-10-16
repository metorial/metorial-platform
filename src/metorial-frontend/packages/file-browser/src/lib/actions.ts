import type { FileEntry } from '../types';
import { isDirectoryLike } from './sort';

export type EntryAction = 'open' | 'download' | 'rename' | 'move' | 'delete';

export type EntryActionItem =
  | { action: EntryAction; label: string; disabled?: boolean }
  | { type: 'separator' };

export let isDownloadable = (entry: Pick<FileEntry, 'type' | 'targetType'>) =>
  entry.type == 'file' || (entry.type == 'symlink' && entry.targetType == 'file');

export let getEntryActions = (
  entry: Pick<FileEntry, 'type' | 'targetType'>,
  opts: { readOnly?: boolean } = {}
): EntryActionItem[] => {
  let items: EntryActionItem[] = [
    { action: 'open', label: isDirectoryLike(entry) ? 'Open Folder' : 'Open' }
  ];

  if (isDownloadable(entry)) items.push({ action: 'download', label: 'Download' });

  if (!opts.readOnly) {
    items.push(
      { type: 'separator' },
      { action: 'rename', label: 'Rename' },
      { action: 'move', label: 'Move' },
      { action: 'delete', label: 'Delete' }
    );
  }

  return items;
};
