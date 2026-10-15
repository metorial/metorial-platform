import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../types';
import {
  filterHiddenEntries,
  isDirectoryLike,
  isHiddenEntry,
  sortEntries,
  toggleSort
} from './sort';

let entry = (name: string, overrides: Partial<FileEntry> = {}): FileEntry => ({
  name,
  path: `/${name}`,
  type: 'file',
  size: 0,
  ...overrides
});

let names = (entries: FileEntry[]) => entries.map(e => e.name);

describe('sortEntries', () => {
  it('puts directories first regardless of direction', () => {
    let entries = [
      entry('b.txt'),
      entry('z', { type: 'directory' }),
      entry('a.txt'),
      entry('c', { type: 'directory' })
    ];

    expect(names(sortEntries(entries, { key: 'name', direction: 'asc' }))).toEqual([
      'c',
      'z',
      'a.txt',
      'b.txt'
    ]);

    expect(names(sortEntries(entries, { key: 'name', direction: 'desc' }))).toEqual([
      'z',
      'c',
      'b.txt',
      'a.txt'
    ]);
  });

  it('sorts names naturally and case-insensitively', () => {
    let entries = [entry('file10'), entry('file2'), entry('File1')];

    expect(names(sortEntries(entries))).toEqual(['File1', 'file2', 'file10']);
  });

  it('sorts by size with name as a tiebreaker', () => {
    let entries = [
      entry('big', { size: 500 }),
      entry('small', { size: 5 }),
      entry('also-small', { size: 5 })
    ];

    expect(names(sortEntries(entries, { key: 'size', direction: 'asc' }))).toEqual([
      'also-small',
      'small',
      'big'
    ]);

    expect(names(sortEntries(entries, { key: 'size', direction: 'desc' }))[0]).toBe('big');
  });

  it('sorts by modified time and places entries without a time first when ascending', () => {
    let entries = [
      entry('new', { modifiedAt: new Date('2026-03-01') }),
      entry('unknown'),
      entry('old', { modifiedAt: new Date('2025-01-01') })
    ];

    expect(names(sortEntries(entries, { key: 'modified', direction: 'asc' }))).toEqual([
      'unknown',
      'old',
      'new'
    ]);
  });

  it('does not mutate its input', () => {
    let entries = [entry('b'), entry('a')];
    sortEntries(entries);

    expect(names(entries)).toEqual(['b', 'a']);
  });
});

describe('directory detection', () => {
  it('treats symlinks to directories like directories', () => {
    expect(isDirectoryLike({ type: 'symlink', targetType: 'directory' })).toBe(true);
    expect(isDirectoryLike({ type: 'symlink', targetType: 'file' })).toBe(false);
    expect(isDirectoryLike({ type: 'symlink' })).toBe(false);
    expect(isDirectoryLike({ type: 'directory' })).toBe(true);
  });
});

describe('hidden entries', () => {
  it('filters dotfiles unless asked to show them', () => {
    let entries = [entry('.env'), entry('app.ts')];

    expect(isHiddenEntry(entries[0]!)).toBe(true);
    expect(names(filterHiddenEntries(entries, false))).toEqual(['app.ts']);
    expect(names(filterHiddenEntries(entries, true))).toEqual(['.env', 'app.ts']);
  });
});

describe('toggleSort', () => {
  it('flips the direction when the same column is chosen again', () => {
    expect(toggleSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({
      key: 'name',
      direction: 'desc'
    });
  });

  it('starts names ascending and other columns descending', () => {
    expect(toggleSort({ key: 'size', direction: 'asc' }, 'name')).toEqual({
      key: 'name',
      direction: 'asc'
    });

    expect(toggleSort({ key: 'name', direction: 'asc' }, 'modified')).toEqual({
      key: 'modified',
      direction: 'desc'
    });
  });
});
