import { describe, expect, it } from 'vitest';
import { getEntryActions, isDownloadable } from './actions';

let actionsOf = (items: ReturnType<typeof getEntryActions>) =>
  items.map(item => ('action' in item ? item.action : '---'));

describe('getEntryActions', () => {
  it('offers the full set for a regular file', () => {
    expect(actionsOf(getEntryActions({ type: 'file' }))).toEqual([
      'open',
      'download',
      '---',
      'rename',
      'move',
      'delete'
    ]);
  });

  it('does not offer download for folders', () => {
    expect(actionsOf(getEntryActions({ type: 'directory' }))).toEqual([
      'open',
      '---',
      'rename',
      'move',
      'delete'
    ]);
  });

  it('removes every mutation when read-only', () => {
    expect(actionsOf(getEntryActions({ type: 'file' }, { readOnly: true }))).toEqual([
      'open',
      'download'
    ]);
  });

  it('only downloads files and links to files', () => {
    expect(isDownloadable({ type: 'file' })).toBe(true);
    expect(isDownloadable({ type: 'symlink', targetType: 'file' })).toBe(true);
    expect(isDownloadable({ type: 'symlink', targetType: 'directory' })).toBe(false);
    expect(isDownloadable({ type: 'other' })).toBe(false);
  });
});
