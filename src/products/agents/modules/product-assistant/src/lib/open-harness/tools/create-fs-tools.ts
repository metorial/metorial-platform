import { tool } from 'ai';
import { z } from 'zod';
import type { FsProvider } from '../providers/types';

// ── Defaults ────────────────────────────────────────────────────────

const DEFAULT_MAX_OUTPUT_BYTES = 32 * 1024; // 32 KB
const DEFAULT_MAX_LINES = 2000;
const DEFAULT_MAX_LINE_LENGTH = 2000;

// Binary file extensions that should never be read as text
const BINARY_EXTENSIONS = new Set([
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
  '.7z',
  '.rar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.obj',
  '.o',
  '.a',
  '.lib',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.webp',
  '.tiff',
  '.tif',
  '.mp3',
  '.mp4',
  '.avi',
  '.mov',
  '.wav',
  '.flac',
  '.ogg',
  '.webm',
  '.mkv',
  '.pdf',
  '.wasm',
  '.class',
  '.jar',
  '.pyc',
  '.pyd',
  '.pyo',
  '.whl',
  '.egg',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.eot',
  '.sqlite',
  '.db',
  '.DS_Store'
]);

export interface CreateFsToolsOptions {
  /** Maximum output size in bytes for read/list/grep responses. Defaults to 32 KB. */
  maxOutputBytes?: number;
  /** Maximum number of lines or entries returned before pagination. Defaults to 2000. */
  maxLines?: number;
  /** Maximum characters per line before truncation in read/grep responses. Defaults to 2000. */
  maxLineLength?: number;
}

export function createFsTools(fs: FsProvider, options?: CreateFsToolsOptions) {
  const maxOutputBytes = options?.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const maxLines = options?.maxLines ?? DEFAULT_MAX_LINES;
  const maxLineLength = options?.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH;

  // ── readFile ────────────────────────────────────────────────────

  const readFile = tool({
    description:
      'Read the contents of a file. Returns the text content with line numbers. ' +
      'For large files, use offset and limit to read specific line ranges.',
    inputSchema: z.object({
      filePath: z.string().describe('Absolute or relative path to the file'),
      offset: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('1-based line number to start reading from'),
      limit: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe(`Maximum number of lines to return (default ${DEFAULT_MAX_LINES})`)
    }),
    execute: async ({ filePath, offset, limit }) => {
      const resolved = fs.resolvePath(filePath);

      // Binary check by extension
      if (isBinaryPath(resolved)) {
        return { error: `Cannot read binary file: ${resolved}` };
      }

      let content: string;
      try {
        content = await fs.readFile(resolved);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'name' in error &&
          error.name === 'FileTooLargeError'
        ) {
          return { error: (error as Error).message };
        }
        throw error;
      }

      const allLines = content.split('\n');
      const totalLines = allLines.length;
      const lineLimit = limit ?? maxLines;
      const start = (offset ?? 1) - 1; // convert 1-based to 0-based

      if (start > 0 && start >= totalLines) {
        return {
          error: `Offset ${offset} is out of range (file has ${totalLines} lines)`,
          filePath: resolved
        };
      }

      const end = Math.min(start + lineLimit, totalLines);
      const slice = allLines.slice(start, end);

      // Truncate long lines and cap total bytes
      let totalBytes = 0;
      let truncatedByBytes = false;
      const outputLines: string[] = [];

      for (let i = 0; i < slice.length; i++) {
        let line = slice[i]!;
        if (line.length > maxLineLength) {
          line =
            line.slice(0, maxLineLength) + `... (line truncated at ${maxLineLength} chars)`;
        }

        const lineBytes = Buffer.byteLength(line, 'utf-8');
        if (totalBytes + lineBytes > maxOutputBytes) {
          truncatedByBytes = true;
          break;
        }

        totalBytes += lineBytes;
        outputLines.push(`${start + i + 1}: ${line}`);
      }

      const lastLine = start + outputLines.length;
      const hasMore = lastLine < totalLines;

      let status: string;
      if (truncatedByBytes) {
        status =
          `Output capped at ${formatBytes(maxOutputBytes)}. ` +
          `Showing lines ${start + 1}-${lastLine} of ${totalLines}. ` +
          `Use offset=${lastLine + 1} to continue.`;
      } else if (hasMore) {
        status =
          `Showing lines ${start + 1}-${lastLine} of ${totalLines}. ` +
          `Use offset=${lastLine + 1} to continue.`;
      } else {
        status = `End of file — ${totalLines} lines total.`;
      }

      return {
        filePath: resolved,
        totalLines,
        fromLine: start + 1,
        toLine: lastLine,
        status,
        content: outputLines.join('\n')
      };
    }
  });

  // ── writeFile ───────────────────────────────────────────────────

  const writeFile = tool({
    description:
      'Write content to a file. Creates the file (and parent directories) ' +
      "if they don't exist, or overwrites the existing file.",
    inputSchema: z.object({
      filePath: z.string().describe('Absolute or relative path to the file'),
      content: z.string().describe('The full content to write')
    }),
    execute: async ({ filePath, content }) => {
      const resolved = fs.resolvePath(filePath);
      await fs.mkdir(dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content);
      return { filePath: resolved, bytesWritten: Buffer.byteLength(content) };
    }
  });

  // ── editFile ────────────────────────────────────────────────────

  const editFile = tool({
    description:
      'Edit a file by replacing exact string matches. The oldString must ' +
      'appear in the file. Set replaceAll to true to replace every occurrence.',
    inputSchema: z.object({
      filePath: z.string().describe('Absolute or relative path to the file'),
      oldString: z.string().describe('The exact text to find'),
      newString: z.string().describe('The replacement text'),
      replaceAll: z
        .boolean()
        .optional()
        .default(false)
        .describe('Replace all occurrences instead of just the first')
    }),
    execute: async ({ filePath, oldString, newString, replaceAll }) => {
      const resolved = fs.resolvePath(filePath);
      const content = await fs.readFile(resolved);

      if (!content.includes(oldString)) {
        return { error: 'oldString not found in file', filePath: resolved };
      }

      const updated = replaceAll
        ? content.replaceAll(oldString, newString)
        : content.replace(oldString, newString);
      await fs.writeFile(resolved, updated);

      const occurrences = content.split(oldString).length - 1;
      const replacements = replaceAll ? occurrences : 1;

      return { filePath: resolved, replacements };
    }
  });

  // ── listFiles ───────────────────────────────────────────────────

  const listFiles = tool({
    description:
      'List files and directories at the given path. ' +
      'Set recursive to true to walk subdirectories. ' +
      'Large results are paginated automatically; use offset and limit to continue.',
    inputSchema: z.object({
      dirPath: z
        .string()
        .optional()
        .default('.')
        .describe('Directory path to list (defaults to cwd)'),
      recursive: z
        .boolean()
        .optional()
        .default(false)
        .describe('Recursively list all entries'),
      offset: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('1-based entry number to start listing from'),
      limit: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe(`Maximum number of entries to return (default ${DEFAULT_MAX_LINES})`)
    }),
    execute: async ({ dirPath, recursive, offset, limit }) => {
      const resolved = fs.resolvePath(dirPath);
      let items: { name: string; type: 'file' | 'directory' }[];

      if (recursive) {
        const walked = await walkDir(fs, resolved, resolved);
        items = walked.map(entry => ({
          name: entry.relativePath,
          type: entry.isDirectory ? ('directory' as const) : ('file' as const)
        }));
      } else {
        const entries = await fs.readdir(resolved);
        items = entries.map(e => ({
          name: e.name,
          type: e.isDirectory ? ('directory' as const) : ('file' as const)
        }));
      }

      const totalCount = items.length;
      const start = (offset ?? 1) - 1;
      const entryLimit = limit ?? maxLines;

      if (start > 0 && start >= totalCount) {
        return {
          error: `Offset ${offset} is out of range (listing has ${totalCount} entries)`,
          dirPath: resolved
        };
      }

      const end = Math.min(start + entryLimit, totalCount);
      const page = items.slice(start, end);
      const { items: entries, truncatedByBytes } = takeItemsWithinByteLimit(
        page,
        maxOutputBytes
      );
      const fromEntry = entries.length > 0 ? start + 1 : 0;
      const toEntry = start + entries.length;
      const hasMore = toEntry < totalCount;

      let status: string;
      if (totalCount === 0) {
        status = 'Directory is empty.';
      } else if (truncatedByBytes) {
        status =
          `Output capped at ${formatBytes(maxOutputBytes)}. ` +
          `Showing entries ${fromEntry}-${toEntry} of ${totalCount}. ` +
          `Use offset=${toEntry + 1} to continue.`;
      } else if (hasMore) {
        status =
          `Showing entries ${fromEntry}-${toEntry} of ${totalCount}. ` +
          `Use offset=${toEntry + 1} to continue.`;
      } else {
        status = `End of listing — ${totalCount} entries total.`;
      }

      return {
        dirPath: resolved,
        count: entries.length,
        totalCount,
        fromEntry,
        toEntry,
        status,
        entries
      };
    }
  });

  // ── grep ────────────────────────────────────────────────────────

  const grep = tool({
    description:
      'Search file contents with a regex pattern. Searches recursively ' +
      'from the given directory, skipping node_modules and .git. ' +
      'Returns matching lines with file paths and line numbers. ' +
      'Large result sets are paginated automatically; use offset and limit to continue.',
    inputSchema: z.object({
      pattern: z.string().describe('Regex pattern to search for'),
      dirPath: z
        .string()
        .optional()
        .default('.')
        .describe('Root directory to search from (defaults to cwd)'),
      glob: z
        .string()
        .optional()
        .describe("Only search files matching this glob suffix (e.g. '.ts')"),
      ignoreCase: z.boolean().optional().default(false).describe('Case-insensitive matching'),
      offset: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('1-based match number to start returning from'),
      limit: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe(`Maximum number of matches to return (default ${DEFAULT_MAX_LINES})`)
    }),
    execute: async ({ pattern, dirPath, glob: fileSuffix, ignoreCase, offset, limit }) => {
      const resolved = fs.resolvePath(dirPath);
      const regex = new RegExp(pattern, ignoreCase ? 'i' : undefined);
      const allFiles = await walkFiles(fs, resolved);

      const files = fileSuffix ? allFiles.filter(f => f.endsWith(fileSuffix)) : allFiles;

      const matches: { file: string; line: number; content: string }[] = [];
      const start = (offset ?? 1) - 1;
      const matchLimit = limit ?? maxLines;
      let matchCount = 0;
      let totalBytes = 0;
      let truncatedByBytes = false;

      for (const file of files) {
        if (isBinaryPath(file)) continue;

        let content: string;
        try {
          content = await fs.readFile(file);
        } catch {
          continue; // skip binary / unreadable / too-large files
        }

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i]!;
          if (regex.test(line)) {
            matchCount += 1;

            if (matchCount <= start || truncatedByBytes || matches.length >= matchLimit) {
              continue;
            }

            const match = {
              file: relativePath(resolved, file),
              line: i + 1,
              content: truncateLine(line, maxLineLength)
            };
            const matchBytes = Buffer.byteLength(JSON.stringify(match), 'utf-8');

            if (totalBytes + matchBytes > maxOutputBytes) {
              truncatedByBytes = true;
              continue;
            }

            totalBytes += matchBytes;
            matches.push(match);
          }
        }
      }

      if (start > 0 && start >= matchCount) {
        return {
          error: `Offset ${offset} is out of range (${matchCount} matches found)`,
          dirPath: resolved,
          pattern,
          matchCount
        };
      }

      const fromMatch = matches.length > 0 ? start + 1 : 0;
      const toMatch = start + matches.length;
      const hasMore = toMatch < matchCount;

      let status: string;
      if (matchCount === 0) {
        status = `No matches found for /${pattern}/.`;
      } else if (truncatedByBytes) {
        status =
          `Output capped at ${formatBytes(maxOutputBytes)}. ` +
          `Showing matches ${fromMatch}-${toMatch} of ${matchCount}. ` +
          `Use offset=${toMatch + 1} to continue.`;
      } else if (hasMore) {
        status =
          `Showing matches ${fromMatch}-${toMatch} of ${matchCount}. ` +
          `Use offset=${toMatch + 1} to continue.`;
      } else {
        status = `End of matches — ${matchCount} total.`;
      }

      return {
        dirPath: resolved,
        pattern,
        matchCount,
        fromMatch,
        toMatch,
        status,
        matches
      };
    }
  });

  // ── deleteFile ──────────────────────────────────────────────────

  const deleteFile = tool({
    description: 'Delete a file or directory. For directories, set recursive to true.',
    inputSchema: z.object({
      filePath: z.string().describe('Path to the file or directory to delete'),
      recursive: z
        .boolean()
        .optional()
        .default(false)
        .describe('Recursively delete directory contents')
    }),
    execute: async ({ filePath, recursive }) => {
      const resolved = fs.resolvePath(filePath);
      const stat = await fs.stat(resolved);

      if (stat.isDirectory && !recursive) {
        return {
          error: 'Path is a directory. Set recursive to true to delete it.',
          filePath: resolved
        };
      }

      await fs.remove(resolved, { recursive });
      return { deleted: resolved };
    }
  });

  return { readFile, writeFile, editFile, listFiles, grep, deleteFile };
}

// ── Helpers ─────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git']);

interface WalkEntry {
  relativePath: string;
  absolutePath: string;
  isDirectory: boolean;
}

/** Recursively walk a directory, returning all entries with relative paths. */
async function walkDir(fs: FsProvider, root: string, dir: string): Promise<WalkEntry[]> {
  const entries = await fs.readdir(dir);
  const results: WalkEntry[] = [];

  for (const entry of entries) {
    const absPath = joinPath(dir, entry.name);
    const relPath = relativePath(root, absPath);
    results.push({
      relativePath: relPath,
      absolutePath: absPath,
      isDirectory: entry.isDirectory
    });
    if (entry.isDirectory && !SKIP_DIRS.has(entry.name)) {
      results.push(...(await walkDir(fs, root, absPath)));
    }
  }

  return results;
}

/** Recursively walk a directory, returning absolute paths of files only. Skips node_modules and .git. */
async function walkFiles(fs: FsProvider, dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const full = joinPath(dir, entry.name);
    if (entry.isDirectory) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...(await walkFiles(fs, full)));
      }
    } else {
      files.push(full);
    }
  }

  return files;
}

function takeItemsWithinByteLimit<T>(
  items: T[],
  maxBytes: number
): { items: T[]; truncatedByBytes: boolean } {
  let totalBytes = 0;
  const limitedItems: T[] = [];

  for (const item of items) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item), 'utf-8');
    if (totalBytes + itemBytes > maxBytes) {
      return { items: limitedItems, truncatedByBytes: true };
    }

    totalBytes += itemBytes;
    limitedItems.push(item);
  }

  return { items: limitedItems, truncatedByBytes: false };
}

function isBinaryPath(filePath: string): boolean {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return false;
  return BINARY_EXTENSIONS.has(filePath.slice(lastDot).toLowerCase());
}

function truncateLine(line: string, maxLength: number): string {
  if (line.length <= maxLength) return line;
  return line.slice(0, maxLength) + `... (line truncated at ${maxLength} chars)`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Simple path join that works with forward slashes. */
function joinPath(base: string, name: string): string {
  if (base.endsWith('/')) return base + name;
  return base + '/' + name;
}

/** Compute a relative path from root to target. */
function relativePath(root: string, target: string): string {
  const normalizedRoot = root.endsWith('/') ? root : root + '/';
  if (target.startsWith(normalizedRoot)) {
    return target.slice(normalizedRoot.length);
  }
  return target;
}

/** Extract directory portion of a path. */
function dirname(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) return '.';
  return filePath.slice(0, lastSlash);
}
