// ── Provider Interfaces ─────────────────────────────────────────────
//
// These interfaces define the contract for environment providers.
// Providers supply filesystem and shell access that tools consume.
// Only isolated virtual implementations are supported; host access
// is intentionally not available.

// ── Filesystem ──────────────────────────────────────────────────────

export interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
}

export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
}

export interface FsProvider {
  /** Whether this provider points at an isolated virtual filesystem or the host filesystem. */
  readonly scope: 'virtual' | 'host';

  /** Read a file's full text content. Should throw if the file exceeds a reasonable size limit. */
  readFile(path: string): Promise<string>;

  /** Write text content to a file, creating parent directories as needed. */
  writeFile(path: string, content: string): Promise<void>;

  /** Check whether a path exists. */
  exists(path: string): Promise<boolean>;

  /** Get file/directory metadata. */
  stat(path: string): Promise<FileStat>;

  /** List entries in a single directory (non-recursive). */
  readdir(path: string): Promise<DirEntry[]>;

  /** Create a directory. When recursive is true, create parent directories as needed. */
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

  /** Remove a file or directory. When recursive is true, remove directory contents. */
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;

  /** Rename or move a file/directory. */
  rename(oldPath: string, newPath: string): Promise<void>;

  /** Resolve a relative path to an absolute path within this provider's context. */
  resolvePath(path: string): string;
}

// ── Shell ───────────────────────────────────────────────────────────

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShellProvider {
  /** Execute a shell command and return its output. */
  exec(
    command: string,
    options?: {
      timeout?: number;
      cwd?: string;
      env?: Record<string, string>;
    }
  ): Promise<ShellResult>;
}
