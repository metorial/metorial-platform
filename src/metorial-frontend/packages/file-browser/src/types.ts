export type FileEntryType = 'file' | 'directory' | 'symlink' | 'other';

export interface FileEntry {
  name: string;
  path: string;
  type: FileEntryType;
  size: number;
  mode?: number;
  modifiedAt?: Date;
  target?: string;
  targetType?: FileEntryType;
}

export interface FileReadResult {
  data: Uint8Array;
  size: number;
  modifiedAt?: Date;
}

export interface FileSystemAdapter {
  list(
    path: string,
    opts?: { signal?: AbortSignal }
  ): Promise<{ entries: FileEntry[]; truncated: boolean }>;

  stat(path: string, opts?: { signal?: AbortSignal }): Promise<FileEntry>;

  read(
    path: string,
    opts?: {
      offset?: number;
      length?: number;
      signal?: AbortSignal;
      onProgress?: (loaded: number, total: number) => void;
    }
  ): Promise<FileReadResult>;

  write(
    path: string,
    data: Blob | Uint8Array,
    opts?: {
      overwrite?: boolean;
      mode?: number;
      signal?: AbortSignal;
      onProgress?: (sent: number, total: number) => void;
    }
  ): Promise<void>;

  mkdir(path: string): Promise<void>;

  move(from: string, to: string): Promise<void>;

  delete(path: string, opts?: { recursive?: boolean }): Promise<void>;
}

export type FileBrowserStatus = 'ready' | 'connecting' | 'disconnected' | 'unavailable';
