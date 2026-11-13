import type { IFileSystem } from './justBash';

let MUTATING_METHODS = new Set([
  'writeFile',
  'writeFileSync',
  'writeFileLazy',
  'appendFile',
  'mkdir',
  'createExclusive',
  'rm',
  'cp',
  'mv',
  'chmod',
  'symlink',
  'link',
  'utimes'
]);

export class ReadOnlyFileSystemError extends Error {
  code = 'EROFS';

  constructor(path: string) {
    super(`EROFS: read-only file system, '${path}'`);
  }
}

export let readOnlyFs = (inner: IFileSystem): IFileSystem =>
  new Proxy(inner, {
    get(target, property, receiver) {
      let value = Reflect.get(target, property, receiver);
      if (typeof value != 'function') return value;

      if (typeof property == 'string' && MUTATING_METHODS.has(property)) {
        return async (path: string) => {
          throw new ReadOnlyFileSystemError(path);
        };
      }

      return value.bind(target);
    }
  });
