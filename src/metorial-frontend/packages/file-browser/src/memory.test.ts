import { describe, expect, it, vi } from 'vitest';
import { getFileSystemErrorCode } from './lib/errors';
import { createMemoryFileSystem } from './memory';

let fixture = () =>
  createMemoryFileSystem({
    files: {
      '/app/src/server.ts': 'export {};\n',
      '/app/package.json': '{}',
      '/readme.md': '# hello'
    },
    directories: ['/empty'],
    symlinks: { '/current': '/app', '/shortcut.md': '/readme.md' }
  });

let codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return getFileSystemErrorCode(error);
  }

  return null;
};

describe('createMemoryFileSystem', () => {
  describe('list', () => {
    it('lists direct children with types and sizes', async () => {
      let fs = fixture();
      let { entries, truncated } = await fs.list('/app');

      expect(truncated).toBe(false);
      expect(entries.map(e => [e.name, e.type]).sort()).toEqual([
        ['package.json', 'file'],
        ['src', 'directory']
      ]);

      expect(entries.find(e => e.name == 'package.json')?.size).toBe(2);
    });

    it('creates missing parents for seeded files', async () => {
      let fs = fixture();
      let root = await fs.list('/');

      expect(root.entries.map(e => e.name).sort()).toEqual([
        'app',
        'current',
        'empty',
        'readme.md',
        'shortcut.md'
      ]);
    });

    it('follows symlinked directories and reports link metadata', async () => {
      let fs = fixture();
      let viaLink = await fs.list('/current');
      let root = await fs.list('/');
      let link = root.entries.find(e => e.name == 'current');

      expect(viaLink.entries.map(e => e.path)).toContain('/current/package.json');
      expect(link).toMatchObject({ type: 'symlink', target: '/app', targetType: 'directory' });
    });

    it('truncates to the configured limit', async () => {
      let fs = createMemoryFileSystem({
        files: { '/a': '', '/b': '', '/c': '' },
        listLimit: 2
      });

      let result = await fs.list('/');

      expect(result.entries).toHaveLength(2);
      expect(result.truncated).toBe(true);
    });

    it('reports missing paths and files', async () => {
      let fs = fixture();

      expect(await codeOf(fs.list('/missing'))).toBe('not_found');
      expect(await codeOf(fs.list('/readme.md'))).toBe('not_a_directory');
    });
  });

  describe('stat', () => {
    it('describes files, directories and missing paths', async () => {
      let fs = fixture();

      expect(await fs.stat('/readme.md')).toMatchObject({
        type: 'file',
        size: 7,
        name: 'readme.md'
      });
      expect(await fs.stat('/app')).toMatchObject({ type: 'directory' });
      expect(await fs.stat('/')).toMatchObject({ type: 'directory', name: '/' });
      expect(await codeOf(fs.stat('/nope'))).toBe('not_found');
    });
  });

  describe('read', () => {
    it('reads whole files', async () => {
      let fs = fixture();
      let result = await fs.read('/readme.md');

      expect(new TextDecoder().decode(result.data)).toBe('# hello');
      expect(result.size).toBe(7);
    });

    it('supports ranged reads and reports the full size', async () => {
      let fs = fixture();
      let result = await fs.read('/readme.md', { offset: 2, length: 3 });

      expect(new TextDecoder().decode(result.data)).toBe('hel');
      expect(result.size).toBe(7);
    });

    it('returns fewer bytes at the end of the file', async () => {
      let fs = fixture();
      let result = await fs.read('/readme.md', { offset: 5, length: 100 });

      expect(new TextDecoder().decode(result.data)).toBe('lo');
    });

    it('follows file symlinks', async () => {
      let fs = fixture();
      let result = await fs.read('/shortcut.md');

      expect(new TextDecoder().decode(result.data)).toBe('# hello');
    });

    it('reports progress up to the total', async () => {
      let fs = createMemoryFileSystem({ files: { '/big': new Uint8Array(200_000) } });
      let onProgress = vi.fn();

      await fs.read('/big', { onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenLastCalledWith(200_000, 200_000);
    });

    it('rejects directories and missing files', async () => {
      let fs = fixture();

      expect(await codeOf(fs.read('/app'))).toBe('not_a_file');
      expect(await codeOf(fs.read('/nope'))).toBe('not_found');
    });

    it('honours abort signals', async () => {
      let fs = fixture();
      let controller = new AbortController();
      controller.abort();

      expect(await codeOf(fs.read('/readme.md', { signal: controller.signal }))).toBe(
        'cancelled'
      );
    });
  });

  describe('write', () => {
    it('creates files from bytes and blobs', async () => {
      let fs = fixture();

      await fs.write('/empty/a.txt', new TextEncoder().encode('bytes'));
      await fs.write('/empty/b.txt', new Blob(['blob']));

      expect(fs.readText('/empty/a.txt')).toBe('bytes');
      expect(fs.readText('/empty/b.txt')).toBe('blob');
    });

    it('refuses to replace a file unless overwrite is set', async () => {
      let fs = fixture();
      let data = new TextEncoder().encode('new');

      expect(await codeOf(fs.write('/readme.md', data))).toBe('already_exists');

      await fs.write('/readme.md', data, { overwrite: true });
      expect(fs.readText('/readme.md')).toBe('new');
    });

    it('keeps the existing mode on overwrite and applies a requested mode', async () => {
      let fs = fixture();

      await fs.write('/empty/run.sh', new Uint8Array(), { mode: 0o755 });
      await fs.write('/empty/run.sh', new Uint8Array([1]), { overwrite: true });

      expect((await fs.stat('/empty/run.sh')).mode).toBe(0o755);
    });

    it('requires an existing parent directory', async () => {
      let fs = fixture();

      expect(await codeOf(fs.write('/nowhere/a.txt', new Uint8Array()))).toBe('not_found');
      expect(await codeOf(fs.write('/readme.md/a.txt', new Uint8Array()))).toBe(
        'not_a_directory'
      );
    });

    it('reports progress and cancels', async () => {
      let fs = fixture();
      let onProgress = vi.fn();

      await fs.write('/empty/data', new Uint8Array(150_000), { onProgress });
      expect(onProgress).toHaveBeenLastCalledWith(150_000, 150_000);

      let controller = new AbortController();
      controller.abort();

      expect(
        await codeOf(fs.write('/empty/x', new Uint8Array(), { signal: controller.signal }))
      ).toBe('cancelled');

      expect(fs.paths()).not.toContain('/empty/x');
    });
  });

  describe('mkdir', () => {
    it('creates directories and rejects duplicates', async () => {
      let fs = fixture();

      await fs.mkdir('/app/new');

      expect((await fs.stat('/app/new')).type).toBe('directory');
      expect(await codeOf(fs.mkdir('/app/new'))).toBe('already_exists');
      expect(await codeOf(fs.mkdir('/missing/child'))).toBe('not_found');
    });
  });

  describe('move', () => {
    it('renames files', async () => {
      let fs = fixture();

      await fs.move('/readme.md', '/README.md');

      expect(fs.readText('/README.md')).toBe('# hello');
      expect(fs.paths()).not.toContain('/readme.md');
    });

    it('moves directories together with their contents', async () => {
      let fs = fixture();

      await fs.move('/app', '/empty/app');

      expect(fs.paths()).toContain('/empty/app/src/server.ts');
      expect(fs.paths()).not.toContain('/app/package.json');
    });

    it('rejects collisions, missing sources and moves into itself', async () => {
      let fs = fixture();

      expect(await codeOf(fs.move('/readme.md', '/app'))).toBe('already_exists');
      expect(await codeOf(fs.move('/nope', '/x'))).toBe('not_found');
      expect(await codeOf(fs.move('/app', '/app/src/app'))).toBe('invalid_path');
      expect(await codeOf(fs.move('/', '/x'))).toBe('permission_denied');
    });
  });

  describe('delete', () => {
    it('deletes files', async () => {
      let fs = fixture();

      await fs.delete('/readme.md');

      expect(fs.paths()).not.toContain('/readme.md');
    });

    it('requires recursive for non-empty directories', async () => {
      let fs = fixture();

      expect(await codeOf(fs.delete('/app'))).toBe('not_empty');

      await fs.delete('/app', { recursive: true });
      expect(fs.paths().some(path => path.startsWith('/app'))).toBe(false);
    });

    it('deletes empty directories without recursive and protects the root', async () => {
      let fs = fixture();

      await fs.delete('/empty');

      expect(fs.paths()).not.toContain('/empty');
      expect(await codeOf(fs.delete('/'))).toBe('permission_denied');
      expect(await codeOf(fs.delete('/nope'))).toBe('not_found');
    });
  });
});
