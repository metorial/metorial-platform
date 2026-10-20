import type {
  BufferEncoding,
  CpOptions,
  FileContent,
  FsStat,
  IFileSystem,
  MkdirOptions,
  RmOptions
} from 'just-bash';
import { InMemoryFs } from 'just-bash';
import { posix as path } from 'node:path';
import {
  assertSkillFileAllowed,
  assertSkillPathRemovable,
  assertValidWorkspacePath,
  isDocumentPath,
  isPathWithin,
  maxSkillWorkspaceFiles,
  normalizeWorkspacePath,
  SkillWorkspaceFsError,
  SkippedContentError
} from './rules';

type ReadOptions = { encoding?: BufferEncoding | null } | BufferEncoding;
type WriteOptions = { encoding?: BufferEncoding } | BufferEncoding;

export type SkillStoreEntry = {
  path: string;
  kind: 'document' | 'file' | 'directory';
  itemId: string;
  documentId?: string;
  fileId?: string;
  title?: string;
  mimeType?: string;
  size?: number;
  load?: () => Promise<FileContent>;
};

export type SkillVirtualFile = {
  read: () => Promise<string>;
  write: (content: string) => Promise<void>;
};

export type SkillPendingChange =
  | { op: 'create'; path: string; kind: 'document' | 'file' | 'directory' }
  | { op: 'modify'; path: string; entry: SkillStoreEntry }
  | { op: 'move'; path: string; fromPath: string; entry: SkillStoreEntry }
  | { op: 'delete'; path: string; entry: SkillStoreEntry };

export type SkillStoreFsOptions = {
  readOnly: boolean;
  readOnlyReason?: string;
};

let decoder = new TextDecoder();

let contentEquals = (a: FileContent, b: FileContent) => {
  if (typeof a == 'string' && typeof b == 'string') return a == b;

  let left = typeof a == 'string' ? new TextEncoder().encode(a) : a;
  let right = typeof b == 'string' ? new TextEncoder().encode(b) : b;
  if (left.byteLength != right.byteLength) return false;

  for (let i = 0; i < left.byteLength; i++) {
    if (left[i] != right[i]) return false;
  }
  return true;
};

export class SkillStoreFs implements IFileSystem {
  private inner = new InMemoryFs();
  private baseline = new Map<string, SkillStoreEntry>();
  private identity = new Map<string, string>();
  private dirty = new Set<string>();
  private originals = new Map<string, FileContent>();
  private skipped = new Map<string, string>();
  private virtualFiles = new Map<string, SkillVirtualFile>();
  private knownDirectories = new Set<string>(['/']);

  constructor(private options: SkillStoreFsOptions) {}

  get readOnly() {
    return this.options.readOnly;
  }

  seed(entries: SkillStoreEntry[]) {
    for (let entry of entries) {
      let entryPath = normalizeWorkspacePath(entry.path);
      let normalized = { ...entry, path: entryPath };

      if (entry.kind == 'directory') {
        if (entryPath != '/') this.inner.mkdirSync(entryPath, { recursive: true });
        this.baseline.set(entryPath, normalized);
        continue;
      }

      this.baseline.set(entryPath, normalized);
      this.identity.set(entryPath, entryPath);
      this.inner.writeFileLazy(entryPath, async () => await this.loadOriginal(entryPath));
    }

    for (let entryPath of this.inner.getAllPaths()) {
      if (!this.identity.has(entryPath)) this.knownDirectories.add(entryPath);
    }
  }

  setVirtualFile(filePath: string, file: SkillVirtualFile) {
    this.virtualFiles.set(normalizeWorkspacePath(filePath), file);
  }

  getEntry(filePath: string) {
    let normalized = normalizeWorkspacePath(filePath);
    let baselinePath = this.identity.get(normalized) ?? normalized;
    return this.baseline.get(baselinePath);
  }

  listFiles() {
    return this.inner
      .getAllPaths()
      .filter(entryPath => this.identity.has(entryPath) || this.dirty.has(entryPath));
  }

  private async loadOriginal(baselinePath: string) {
    let cached = this.originals.get(baselinePath);
    if (cached !== undefined) return cached;

    let entry = this.baseline.get(baselinePath);
    let content: FileContent = '';
    try {
      if (entry?.load) content = await entry.load();
    } catch (error) {
      if (!(error instanceof SkippedContentError)) throw error;
      this.skipped.set(baselinePath, error.message);
    }

    this.originals.set(baselinePath, content);
    return content;
  }

  private async assertContentLoaded(operation: string, filePath: string) {
    let baselinePath = this.identity.get(filePath);
    if (!baselinePath || this.dirty.has(filePath)) return;

    await this.loadOriginal(baselinePath);
    this.assertNotSkipped(operation, filePath);
  }

  private assertNotSkipped(operation: string, filePath: string) {
    let baselinePath = this.identity.get(filePath);
    if (!baselinePath || this.dirty.has(filePath)) return;

    let reason = this.skipped.get(baselinePath);
    if (!reason) return;

    throw new SkillWorkspaceFsError(
      'EFBIG',
      `${operation} '${filePath}' is not allowed: ${reason}, so it reads as empty here`
    );
  }

  private assertWritable(operation: string, filePath: string) {
    if (!this.options.readOnly) return;

    throw new SkillWorkspaceFsError(
      'EROFS',
      `${this.options.readOnlyReason ?? 'read-only file system'}, ${operation} '${filePath}'`
    );
  }

  private assertNotVirtual(operation: string, filePath: string) {
    for (let virtualPath of this.virtualFiles.keys()) {
      if (isPathWithin(virtualPath, filePath)) {
        throw new SkillWorkspaceFsError(
          'EPERM',
          `${operation} '${virtualPath}' is not allowed while it is open in the editor. Edit its content instead.`
        );
      }
    }
  }

  private assertCanCreateFile(filePath: string) {
    if (this.identity.has(filePath) || this.dirty.has(filePath)) return;
    if (this.listFiles().length < maxSkillWorkspaceFiles) return;

    throw new SkillWorkspaceFsError(
      'EFBIG',
      `skills cannot contain more than ${maxSkillWorkspaceFiles} files`
    );
  }

  private pathsWithin(filePath: string) {
    return this.inner.getAllPaths().filter(entryPath => isPathWithin(entryPath, filePath));
  }

  async readFile(filePath: string, options?: ReadOptions) {
    let normalized = normalizeWorkspacePath(filePath);
    let virtualFile = this.virtualFiles.get(normalized);
    if (virtualFile) return await virtualFile.read();

    return await this.inner.readFile(normalized, options);
  }

  async readFileBuffer(filePath: string) {
    let normalized = normalizeWorkspacePath(filePath);
    let virtualFile = this.virtualFiles.get(normalized);
    if (virtualFile) return new TextEncoder().encode(await virtualFile.read());

    return await this.inner.readFileBuffer(normalized);
  }

  async writeFile(filePath: string, content: FileContent, options?: WriteOptions) {
    let normalized = normalizeWorkspacePath(filePath);
    this.assertWritable('write', normalized);

    let virtualFile = this.virtualFiles.get(normalized);
    if (virtualFile) {
      await virtualFile.write(typeof content == 'string' ? content : decoder.decode(content));
      return;
    }

    assertSkillFileAllowed(normalized);
    this.assertCanCreateFile(normalized);
    this.assertNotSkipped('writing', normalized);

    await this.inner.writeFile(normalized, content, options);
    this.dirty.add(normalized);
  }

  async appendFile(filePath: string, content: FileContent, options?: WriteOptions) {
    let normalized = normalizeWorkspacePath(filePath);
    this.assertWritable('write', normalized);

    let virtualFile = this.virtualFiles.get(normalized);
    if (virtualFile) {
      let appended = typeof content == 'string' ? content : decoder.decode(content);
      await virtualFile.write((await virtualFile.read()) + appended);
      return;
    }

    assertSkillFileAllowed(normalized);
    this.assertCanCreateFile(normalized);
    await this.assertContentLoaded('appending to', normalized);

    await this.inner.appendFile(normalized, content, options);
    this.dirty.add(normalized);
  }

  async exists(filePath: string) {
    return await this.inner.exists(normalizeWorkspacePath(filePath));
  }

  async stat(filePath: string): Promise<FsStat> {
    let normalized = normalizeWorkspacePath(filePath);
    let stat = await this.inner.stat(normalized);
    if (!stat.isFile) return stat;

    let virtualFile = this.virtualFiles.get(normalized);
    if (virtualFile) {
      return { ...stat, size: new TextEncoder().encode(await virtualFile.read()).byteLength };
    }

    let baselinePath = this.identity.get(normalized);
    let entry = baselinePath ? this.baseline.get(baselinePath) : undefined;
    if (baselinePath && entry?.size !== undefined && !this.dirty.has(normalized)) {
      if (!this.originals.has(baselinePath) || this.skipped.has(baselinePath)) {
        return { ...stat, size: entry.size };
      }
    }

    return stat;
  }

  async lstat(filePath: string) {
    return await this.stat(filePath);
  }

  async mkdir(filePath: string, options?: MkdirOptions) {
    let normalized = normalizeWorkspacePath(filePath);
    if (options?.recursive && (await this.inner.exists(normalized))) {
      if ((await this.inner.stat(normalized)).isDirectory) return;
    }

    this.assertWritable('mkdir', normalized);
    assertValidWorkspacePath(normalized);

    await this.inner.mkdir(normalized, options);
  }

  async readdir(filePath: string) {
    return await this.inner.readdir(normalizeWorkspacePath(filePath));
  }

  async readdirWithFileTypes(filePath: string) {
    return await this.inner.readdirWithFileTypes(normalizeWorkspacePath(filePath));
  }

  async rm(filePath: string, options?: RmOptions) {
    let normalized = normalizeWorkspacePath(filePath);
    this.assertWritable('rm', normalized);
    this.assertNotVirtual('removing', normalized);

    let affected = this.pathsWithin(normalized);
    for (let affectedPath of affected) assertSkillPathRemovable(affectedPath);

    await this.inner.rm(normalized, options);

    for (let affectedPath of affected) {
      this.identity.delete(affectedPath);
      this.dirty.delete(affectedPath);
    }
  }

  async cp(src: string, dest: string, options?: CpOptions) {
    let from = normalizeWorkspacePath(src);
    let to = normalizeWorkspacePath(dest);
    this.assertWritable('cp', to);
    assertValidWorkspacePath(to);

    let virtualFile = this.virtualFiles.get(from);
    if (virtualFile) {
      await this.writeFile(to, await virtualFile.read());
      return;
    }

    for (let sourcePath of this.pathsWithin(from)) {
      await this.assertContentLoaded('copying', sourcePath);
    }

    await this.inner.cp(from, to, options);

    for (let copiedPath of this.pathsWithin(to)) {
      let stat = await this.inner.stat(copiedPath);
      if (!stat.isFile) continue;

      assertSkillFileAllowed(copiedPath);
      this.dirty.add(copiedPath);
    }
  }

  async mv(src: string, dest: string) {
    let from = normalizeWorkspacePath(src);
    let to = normalizeWorkspacePath(dest);
    this.assertWritable('mv', from);
    this.assertNotVirtual('moving', from);
    assertValidWorkspacePath(to);

    let affected = this.pathsWithin(from);
    for (let affectedPath of affected) {
      assertSkillPathRemovable(affectedPath);
      let targetPath = to + affectedPath.slice(from.length);
      let stat = await this.inner.stat(affectedPath);
      if (stat.isFile) assertSkillFileAllowed(targetPath);
    }

    await this.inner.mv(from, to);

    for (let affectedPath of affected) {
      let targetPath = to + affectedPath.slice(from.length);
      let baselinePath = this.identity.get(affectedPath);
      if (baselinePath) {
        this.identity.delete(affectedPath);
        this.identity.set(targetPath, baselinePath);
      }
      if (this.dirty.delete(affectedPath)) this.dirty.add(targetPath);
    }
  }

  resolvePath(base: string, filePath: string) {
    return this.inner.resolvePath(base, filePath);
  }

  getAllPaths() {
    return this.inner.getAllPaths();
  }

  async chmod(filePath: string, mode: number) {
    await this.inner.chmod(normalizeWorkspacePath(filePath), mode);
  }

  async symlink(_target: string, linkPath: string) {
    throw new SkillWorkspaceFsError('EPERM', `symlinks are not supported, '${linkPath}'`);
  }

  async link(_existingPath: string, newPath: string) {
    throw new SkillWorkspaceFsError('EPERM', `hard links are not supported, '${newPath}'`);
  }

  async readlink(filePath: string) {
    return await this.inner.readlink(normalizeWorkspacePath(filePath));
  }

  async realpath(filePath: string) {
    return await this.inner.realpath(normalizeWorkspacePath(filePath));
  }

  async utimes(filePath: string, atime: Date, mtime: Date) {
    await this.inner.utimes(normalizeWorkspacePath(filePath), atime, mtime);
  }

  async readContent(filePath: string) {
    return await this.inner.readFileBuffer(normalizeWorkspacePath(filePath));
  }

  async collectChanges(): Promise<SkillPendingChange[]> {
    let changes: SkillPendingChange[] = [];
    let currentPaths = new Set(this.inner.getAllPaths());
    let trackedBaselinePaths = new Set(this.identity.values());

    for (let [baselinePath, entry] of this.baseline) {
      if (entry.kind == 'directory' || trackedBaselinePaths.has(baselinePath)) continue;
      changes.push({ op: 'delete', path: baselinePath, entry });
    }

    for (let [currentPath, baselinePath] of this.identity) {
      let entry = this.baseline.get(baselinePath)!;
      if (currentPath != baselinePath) {
        changes.push({ op: 'move', path: currentPath, fromPath: baselinePath, entry });
      }

      if (!this.dirty.has(currentPath)) continue;

      let next = await this.inner.readFileBuffer(currentPath);
      let original = await this.loadOriginal(baselinePath);
      if (!this.skipped.has(baselinePath) && contentEquals(next, original)) {
        this.dirty.delete(currentPath);
        continue;
      }

      changes.push({ op: 'modify', path: currentPath, entry });
    }

    for (let dirtyPath of this.dirty) {
      if (this.identity.has(dirtyPath) || !currentPaths.has(dirtyPath)) continue;
      changes.push({
        op: 'create',
        path: dirtyPath,
        kind: isDocumentPath(dirtyPath) ? 'document' : 'file'
      });
    }

    for (let currentPath of currentPaths) {
      if (this.knownDirectories.has(currentPath) || this.baseline.has(currentPath)) continue;
      if (this.identity.has(currentPath) || this.dirty.has(currentPath)) continue;

      let stat = await this.inner.stat(currentPath);
      if (!stat.isDirectory) continue;
      if ((await this.inner.readdir(currentPath)).length > 0) continue;

      changes.push({ op: 'create', path: currentPath, kind: 'directory' });
    }

    for (let [baselinePath, entry] of this.baseline) {
      if (entry.kind != 'directory' || baselinePath == '/') continue;
      if (currentPaths.has(baselinePath)) continue;
      changes.push({ op: 'delete', path: baselinePath, entry });
    }

    return changes;
  }

  async acknowledge(change: SkillPendingChange, entry?: SkillStoreEntry) {
    if (change.op == 'delete') {
      this.baseline.delete(change.path);
      this.originals.delete(change.path);
      this.skipped.delete(change.path);
      return;
    }

    if (change.op == 'move') {
      let baselineEntry = this.baseline.get(change.fromPath);
      let original = this.originals.get(change.fromPath);
      let skippedReason = this.skipped.get(change.fromPath);
      this.baseline.delete(change.fromPath);
      this.originals.delete(change.fromPath);
      this.skipped.delete(change.fromPath);
      if (baselineEntry)
        this.baseline.set(change.path, { ...baselineEntry, path: change.path });
      if (original !== undefined) this.originals.set(change.path, original);
      if (skippedReason) this.skipped.set(change.path, skippedReason);
      this.identity.set(change.path, change.path);
      return;
    }

    if (change.op == 'create') {
      if (entry) this.baseline.set(change.path, entry);
      if (change.kind == 'directory') {
        this.knownDirectories.add(change.path);
        return;
      }

      this.identity.set(change.path, change.path);
      this.dirty.delete(change.path);
      this.originals.set(change.path, await this.inner.readFileBuffer(change.path));
      return;
    }

    let baselinePath = this.identity.get(change.path) ?? change.path;
    this.dirty.delete(change.path);
    this.skipped.delete(baselinePath);
    this.originals.set(baselinePath, await this.inner.readFileBuffer(change.path));
    if (entry) {
      let current = this.baseline.get(baselinePath);
      this.baseline.set(baselinePath, { ...current, ...entry, path: baselinePath });
    }
  }

  async revert(change: SkillPendingChange) {
    if (change.op == 'create') {
      this.dirty.delete(change.path);
      await this.inner.rm(change.path, { recursive: true, force: true });
      return;
    }

    if (change.op == 'delete') {
      if (change.entry.kind == 'directory') {
        await this.inner.mkdir(change.path, { recursive: true });
        return;
      }

      await this.inner.mkdir(path.dirname(change.path), { recursive: true });
      this.inner.writeFileLazy(change.path, async () => await this.loadOriginal(change.path));
      this.identity.set(change.path, change.path);
      return;
    }

    if (change.op == 'move') {
      await this.inner.mkdir(path.dirname(change.fromPath), { recursive: true });
      await this.inner.mv(change.path, change.fromPath);
      this.identity.delete(change.path);
      this.identity.set(change.fromPath, change.fromPath);
      if (this.dirty.delete(change.path)) this.dirty.add(change.fromPath);
      return;
    }

    let baselinePath = this.identity.get(change.path) ?? change.path;
    await this.inner.writeFile(change.path, await this.loadOriginal(baselinePath));
    this.dirty.delete(change.path);
  }
}
