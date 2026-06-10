import type { IFileSystem } from 'just-bash';
import { posix as path } from 'node:path';
import type { DirEntry, FileStat, FsProvider } from '../open-harness';

export class JustBashFsProvider implements FsProvider {
  readonly scope = 'virtual' as const;

  constructor(
    private readonly fs: IFileSystem,
    private readonly cwd: string
  ) {}

  resolvePath(filePath: string) {
    return path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.resolve(this.cwd, filePath);
  }

  async readFile(filePath: string) {
    return await this.fs.readFile(this.resolvePath(filePath), 'utf8');
  }

  async writeFile(filePath: string, content: string) {
    let resolvedPath = this.resolvePath(filePath);
    await this.fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await this.fs.writeFile(resolvedPath, content);
  }

  async exists(filePath: string) {
    return await this.fs.exists(this.resolvePath(filePath));
  }

  async stat(filePath: string): Promise<FileStat> {
    let stat = await this.fs.stat(this.resolvePath(filePath));

    return {
      isFile: stat.isFile,
      isDirectory: stat.isDirectory,
      size: stat.size
    };
  }

  async readdir(dirPath: string): Promise<DirEntry[]> {
    let resolvedPath = this.resolvePath(dirPath);

    if (this.fs.readdirWithFileTypes) {
      let entries = await this.fs.readdirWithFileTypes(resolvedPath);

      return entries.map(entry => ({
        name: entry.name,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory
      }));
    }

    let names = await this.fs.readdir(resolvedPath);
    let entries: DirEntry[] = [];

    for (let name of names) {
      let stat = await this.fs.stat(path.join(resolvedPath, name));

      entries.push({
        name,
        isFile: stat.isFile,
        isDirectory: stat.isDirectory
      });
    }

    return entries;
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }) {
    await this.fs.mkdir(this.resolvePath(dirPath), options);
  }

  async remove(filePath: string, options?: { recursive?: boolean }) {
    await this.fs.rm(this.resolvePath(filePath), options);
  }

  async rename(oldPath: string, newPath: string) {
    await this.fs.mv(this.resolvePath(oldPath), this.resolvePath(newPath));
  }
}
