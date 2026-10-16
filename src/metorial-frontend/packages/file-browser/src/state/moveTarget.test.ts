import { describe, expect, it } from 'vitest';
import { createMemoryFileSystem } from '../memory';
import { resolveMoveTarget } from './moveTarget';

let source = { path: '/a/notes.txt' };

let fs = () =>
  createMemoryFileSystem({
    files: { '/a/notes.txt': 'x', '/docs/existing.md': 'y' },
    symlinks: { '/link-to-docs': '/docs' }
  });

describe('resolveMoveTarget', () => {
  it('moves into an existing folder', async () => {
    expect(await resolveMoveTarget(fs(), source, '/docs')).toBe('/docs/notes.txt');
  });

  it('moves into a folder given with a trailing slash, even if it does not exist yet', async () => {
    expect(await resolveMoveTarget(fs(), source, '/new/')).toBe('/new/notes.txt');
  });

  it('moves into a symlinked folder', async () => {
    expect(await resolveMoveTarget(fs(), source, '/link-to-docs')).toBe(
      '/link-to-docs/notes.txt'
    );
  });

  it('uses the input as the final path when nothing exists there', async () => {
    expect(await resolveMoveTarget(fs(), source, '/docs/renamed.txt')).toBe(
      '/docs/renamed.txt'
    );
  });

  it('keeps an existing file path so the adapter can report the collision', async () => {
    expect(await resolveMoveTarget(fs(), source, '/docs/existing.md')).toBe(
      '/docs/existing.md'
    );
  });

  it('propagates unexpected stat failures', async () => {
    let adapter = fs();
    adapter.stat = async () => {
      throw new Error('socket closed');
    };

    await expect(resolveMoveTarget(adapter, source, '/docs')).rejects.toThrow('socket closed');
  });
});
