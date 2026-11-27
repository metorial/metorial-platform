import { formatFileSize, useUploadQueue } from '@metorial/file-upload';
import { confirm, toast } from '@metorial/ui';
import { useCallback, useEffect, useRef } from 'react';
import { showPromptDialog } from '../components/dialogs';
import { saveBlob, toBlobPart } from '../lib/download';
import { describeFileSystemError } from '../lib/errors';
import { dirname, joinPath, normalizePath, validateEntryName } from '../lib/path';
import { isDirectoryLike } from '../lib/sort';
import { partitionUploads, summarizeNames, type UploadTarget } from '../lib/upload';
import type { FileEntry, FileSystemAdapter } from '../types';
import type { DirectoryStore } from './directoryStore';
import { resolveMoveTarget } from './moveTarget';

let REFRESH_DEBOUNCE_MS = 250;
let DOWNLOAD_PROGRESS_INTERVAL_MS = 150;

export interface FileOperationsOptions {
  adapter: FileSystemAdapter;
  store: DirectoryStore;
  readOnly: boolean;
  directoryPath: string;
  maxUploadSize?: number;
  uploadConcurrency?: number;
  onOpenPath: (path: string) => void;
  onMoved: (from: string, to: string) => void;
  onDeleted: (path: string) => void;
}

let getStemEnd = (name: string) => {
  let dot = name.lastIndexOf('.');
  return dot > 0 ? dot : name.length;
};

let plural = (count: number, singular: string, pluralForm: string) =>
  count == 1 ? singular : pluralForm;

export let useFileOperations = (opts: FileOperationsOptions) => {
  let { adapter, store } = opts;

  let optionsRef = useRef(opts);
  optionsRef.current = opts;

  let pendingRefresh = useRef(new Set<string>());
  let refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  let refreshDirectories = useCallback(
    (directories: string[]) => {
      for (let directory of directories) {
        if (store.get(directory)) void store.load(directory, { force: true });
      }
    },
    [store]
  );

  let scheduleRefresh = useCallback(
    (directory: string) => {
      pendingRefresh.current.add(directory);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);

      refreshTimer.current = setTimeout(() => {
        let directories = Array.from(pendingRefresh.current);

        pendingRefresh.current.clear();
        refreshDirectories(directories);
      }, REFRESH_DEBOUNCE_MS);
    },
    [refreshDirectories]
  );

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    []
  );

  let uploads = useUploadQueue<UploadTarget>({
    concurrency: opts.uploadConcurrency,
    upload: async task => {
      let { directory, overwrite } = task.meta!;

      await adapter.write(joinPath(directory, task.file.name), task.file, {
        overwrite,
        signal: task.signal,
        onProgress: task.onProgress
      });
    },
    onDone: item => scheduleRefresh(item.meta!.directory)
  });

  useEffect(() => () => uploads.cancelAll(), [adapter]);

  let startUploads = async (files: File[], directory: string) => {
    let { readOnly, maxUploadSize } = optionsRef.current;
    if (readOnly || !files.length) return;

    let accepted = files;

    if (maxUploadSize != undefined) {
      let oversized = files.filter(file => file.size > maxUploadSize!);
      accepted = files.filter(file => file.size <= maxUploadSize!);

      if (oversized.length) {
        toast.error(
          `${summarizeNames(oversized.map(file => file.name))} ${plural(oversized.length, 'is', 'are')} larger than the ${formatFileSize(maxUploadSize)} upload limit.`
        );
      }
    }

    if (!accepted.length) return;

    await store.load(directory);

    let { fresh, conflicting } = partitionUploads(
      accepted,
      store.get(directory)?.entries ?? []
    );
    let enqueue = (list: File[], overwrite: boolean) => {
      if (list.length) uploads.add(list, { directory, overwrite });
    };

    if (!conflicting.length) return enqueue(fresh, false);

    let everyFileConflicts = !fresh.length;

    confirm({
      title: 'Replace Existing Files',
      description: `${summarizeNames(conflicting.map(file => file.name))} ${plural(conflicting.length, 'already exists', 'already exist')} in ${directory}. Replace ${plural(conflicting.length, 'it', 'them')} with the uploaded ${plural(conflicting.length, 'file', 'files')}?`,
      confirmText: 'Replace',
      cancelText: everyFileConflicts ? 'Cancel' : 'Skip Existing',
      onConfirm: () => {
        enqueue(fresh, false);
        enqueue(conflicting, true);
      },
      onCancel: () => enqueue(fresh, false)
    });
  };

  let notifySkippedFolders = (skipped: number, fileCount: number) => {
    toast.info(
      fileCount
        ? `Skipped ${skipped} ${plural(skipped, 'folder', 'folders')}. Only files can be uploaded.`
        : 'Folders can’t be uploaded. Drop files instead.'
    );
  };

  let downloadEntry = async (entry: FileEntry) => {
    let id = `download:${entry.path}`;
    let lastUpdate = 0;

    toast.loading(`Downloading ${entry.name}`, { id });

    try {
      let result = await adapter.read(entry.path, {
        onProgress: (loaded, total) => {
          let now = Date.now();
          if (total <= 0 || now - lastUpdate < DOWNLOAD_PROGRESS_INTERVAL_MS) return;

          lastUpdate = now;
          toast.loading(`Downloading ${entry.name} · ${Math.round((loaded / total) * 100)}%`, {
            id
          });
        }
      });

      saveBlob(new Blob([toBlobPart(result.data)]), entry.name);
      toast.success(`Downloaded ${entry.name}`, { id });
    } catch (error) {
      toast.error(describeFileSystemError(error, { path: entry.path }).message, { id });
    }
  };

  let renameEntry = (entry: FileEntry) => {
    let directory = isDirectoryLike(entry);

    showPromptDialog({
      title: directory ? 'Rename Folder' : 'Rename File',
      label: 'Name',
      initialValue: entry.name,
      confirmText: 'Rename',
      selectRange: [0, getStemEnd(entry.name)],
      validate: validateEntryName,
      onSubmit: async name => {
        if (name == entry.name) return;

        let target = joinPath(dirname(entry.path), name);

        await adapter.move(entry.path, target);

        refreshDirectories([dirname(entry.path)]);
        optionsRef.current.onMoved(entry.path, target);
      }
    });
  };

  let moveEntry = (entry: FileEntry) => {
    let directory = isDirectoryLike(entry);

    showPromptDialog({
      title: directory ? 'Move Folder' : 'Move File',
      description: 'Enter the full destination path, or a folder to move it into.',
      label: 'Destination',
      initialValue: entry.path,
      confirmText: 'Move',
      selectRange: [entry.path.length - entry.name.length, entry.path.length],
      validate: value => (value.startsWith('/') ? null : 'Enter an absolute path.'),
      onSubmit: async value => {
        let target = await resolveMoveTarget(adapter, entry, value);
        if (target == normalizePath(entry.path)) return;

        await adapter.move(entry.path, target);

        refreshDirectories([dirname(entry.path), dirname(target)]);
        optionsRef.current.onMoved(entry.path, target);
      }
    });
  };

  let deleteEntry = (entry: FileEntry) => {
    let isFolder = entry.type == 'directory';

    confirm({
      title: isFolder ? 'Delete Folder' : 'Delete File',
      description: isFolder
        ? `${entry.name} and everything inside it will be permanently deleted.`
        : `${entry.name} will be permanently deleted.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await adapter.delete(entry.path, { recursive: isFolder });

          refreshDirectories([dirname(entry.path)]);
          optionsRef.current.onDeleted(entry.path);

          toast.success(`Deleted ${entry.name}`);
        } catch (error) {
          toast.error(describeFileSystemError(error, { path: entry.path }).message);
        }
      }
    });
  };

  let createFolder = () => {
    let directory = optionsRef.current.directoryPath;

    showPromptDialog({
      title: 'New Folder',
      label: 'Name',
      placeholder: 'folder-name',
      confirmText: 'Create Folder',
      validate: validateEntryName,
      onSubmit: async name => {
        await adapter.mkdir(joinPath(directory, name));
        await store.load(directory, { force: true });
      }
    });
  };

  let createFile = () => {
    let directory = optionsRef.current.directoryPath;

    showPromptDialog({
      title: 'New File',
      label: 'Name',
      placeholder: 'file.txt',
      confirmText: 'Create File',
      validate: validateEntryName,
      onSubmit: async name => {
        let target = joinPath(directory, name);

        await adapter.write(target, new Uint8Array(0), { overwrite: false });
        await store.load(directory, { force: true });

        optionsRef.current.onOpenPath(target);
      }
    });
  };

  return {
    uploads,
    startUploads,
    notifySkippedFolders,
    downloadEntry,
    renameEntry,
    moveEntry,
    deleteEntry,
    createFolder,
    createFile
  };
};
