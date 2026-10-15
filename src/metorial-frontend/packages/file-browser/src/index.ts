export { FileBrowser, type FileBrowserProps } from './components/fileBrowser';
export {
  describeFileSystemError,
  FileSystemError,
  getFileSystemErrorCode,
  type FileSystemErrorCode
} from './lib/errors';
export { basename, dirname, joinPath, normalizePath } from './lib/path';
export {
  createMemoryFileSystem,
  type MemoryFileSystem,
  type MemoryFileSystemOptions
} from './memory';
export type {
  FileBrowserStatus,
  FileEntry,
  FileEntryType,
  FileReadResult,
  FileSystemAdapter
} from './types';
