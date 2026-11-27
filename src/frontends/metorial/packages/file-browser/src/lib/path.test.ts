import { describe, expect, it } from 'vitest';
import {
  basename,
  dirname,
  extname,
  getAncestorPaths,
  getPathSegments,
  hasHiddenSegment,
  isRootPath,
  isSameOrDescendant,
  joinPath,
  normalizePath,
  replacePathPrefix,
  validateEntryName
} from './path';

describe('normalizePath', () => {
  it('resolves empty and missing input to the root', () => {
    expect(normalizePath('')).toBe('/');
    expect(normalizePath(undefined)).toBe('/');
    expect(normalizePath(null)).toBe('/');
  });

  it('collapses duplicate slashes, dots and trailing slashes', () => {
    expect(normalizePath('//app///src/')).toBe('/app/src');
    expect(normalizePath('/app/./src')).toBe('/app/src');
  });

  it('resolves parent segments without escaping the root', () => {
    expect(normalizePath('/app/src/../lib')).toBe('/app/lib');
    expect(normalizePath('/../../etc')).toBe('/etc');
  });

  it('treats relative input as absolute', () => {
    expect(normalizePath('app/src')).toBe('/app/src');
  });
});

describe('joinPath', () => {
  it('appends segments to the base', () => {
    expect(joinPath('/app', 'src', 'index.ts')).toBe('/app/src/index.ts');
  });

  it('lets an absolute segment replace the base', () => {
    expect(joinPath('/app', '/etc', 'hosts')).toBe('/etc/hosts');
  });

  it('ignores empty segments', () => {
    expect(joinPath('/app', '', 'src')).toBe('/app/src');
  });
});

describe('dirname and basename', () => {
  it('splits a nested path', () => {
    expect(dirname('/app/src/index.ts')).toBe('/app/src');
    expect(basename('/app/src/index.ts')).toBe('index.ts');
  });

  it('keeps top-level entries under the root', () => {
    expect(dirname('/app')).toBe('/');
    expect(dirname('/')).toBe('/');
    expect(basename('/')).toBe('');
  });
});

describe('extname', () => {
  it('returns the lowercased extension', () => {
    expect(extname('/a/Readme.MD')).toBe('.md');
    expect(extname('/a/archive.tar.gz')).toBe('.gz');
  });

  it('returns an empty string for dotfiles and extensionless names', () => {
    expect(extname('/home/.bashrc')).toBe('');
    expect(extname('/usr/bin/node')).toBe('');
  });
});

describe('root and ancestry checks', () => {
  it('identifies the root path', () => {
    expect(isRootPath('/')).toBe(true);
    expect(isRootPath('//')).toBe(true);
    expect(isRootPath('/app')).toBe(false);
  });

  it('matches descendants on segment boundaries only', () => {
    expect(isSameOrDescendant('/app/src', '/app')).toBe(true);
    expect(isSameOrDescendant('/app', '/app')).toBe(true);
    expect(isSameOrDescendant('/application', '/app')).toBe(false);
    expect(isSameOrDescendant('/anything', '/')).toBe(true);
  });

  it('lists every ancestor from the root down', () => {
    expect(getAncestorPaths('/a/b/c')).toEqual(['/', '/a', '/a/b', '/a/b/c']);
    expect(getAncestorPaths('/')).toEqual(['/']);
  });

  it('builds breadcrumb segments', () => {
    expect(getPathSegments('/a/b')).toEqual([
      { name: '/', path: '/' },
      { name: 'a', path: '/a' },
      { name: 'b', path: '/a/b' }
    ]);
  });
});

describe('replacePathPrefix', () => {
  it('rewrites the moved path and its descendants', () => {
    expect(replacePathPrefix('/a/b/c.txt', '/a/b', '/x/y')).toBe('/x/y/c.txt');
    expect(replacePathPrefix('/a/b', '/a/b', '/x')).toBe('/x');
  });

  it('leaves unrelated paths untouched', () => {
    expect(replacePathPrefix('/a/bc', '/a/b', '/x')).toBe('/a/bc');
  });
});

describe('validateEntryName', () => {
  it('accepts ordinary names', () => {
    expect(validateEntryName('notes.txt')).toBeNull();
    expect(validateEntryName('  spaced  ')).toBeNull();
  });

  it('rejects empty, dot and slash names', () => {
    expect(validateEntryName('   ')).toMatch(/enter a name/i);
    expect(validateEntryName('..')).toMatch(/isn't a valid name/i);
    expect(validateEntryName('a/b')).toMatch(/can.t contain/i);
  });

  it('limits names to 255 bytes', () => {
    expect(validateEntryName('a'.repeat(255))).toBeNull();
    expect(validateEntryName('a'.repeat(256))).toMatch(/255 bytes/);
    expect(validateEntryName('é'.repeat(128))).toMatch(/255 bytes/);
  });
});

describe('hasHiddenSegment', () => {
  it('detects dotted segments anywhere in the path', () => {
    expect(hasHiddenSegment('/home/.config/app')).toBe(true);
    expect(hasHiddenSegment('/home/user/.bashrc')).toBe(true);
    expect(hasHiddenSegment('/home/user')).toBe(false);
  });
});
