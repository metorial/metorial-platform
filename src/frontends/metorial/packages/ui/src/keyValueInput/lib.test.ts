import { describe, expect, it } from 'vitest';
import {
  getDuplicateKeys,
  insertKeyValueEntries,
  keyValueEntriesToRecord,
  parseKeyValueText
} from './lib';

describe('parseKeyValueText', () => {
  it('parses dotenv-style lines', () => {
    let text = [
      '# comment',
      'export NODE_ENV=production',
      '',
      'API_URL = "https://example.com?a=b"',
      "GREETING='hello world'",
      'MULTI="line\\nbreak"',
      'EMPTY='
    ].join('\n');

    expect(parseKeyValueText(text)).toEqual([
      { key: 'NODE_ENV', value: 'production' },
      { key: 'API_URL', value: 'https://example.com?a=b' },
      { key: 'GREETING', value: 'hello world' },
      { key: 'MULTI', value: 'line\nbreak' },
      { key: 'EMPTY', value: '' }
    ]);
  });

  it('rejects text that is not a list of assignments', () => {
    expect(parseKeyValueText('just some text')).toBeNull();
    expect(parseKeyValueText('A=1\nnot an assignment')).toBeNull();
    expect(parseKeyValueText('=value')).toBeNull();
    expect(parseKeyValueText('MY KEY=value')).toBeNull();
    expect(parseKeyValueText('\n# only comments\n')).toBeNull();
  });

  it('handles windows line endings', () => {
    expect(parseKeyValueText('A=1\r\nB=2\r\n')).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: '2' }
    ]);
  });
});

describe('getDuplicateKeys', () => {
  it('returns keys that appear more than once, ignoring empty keys', () => {
    let duplicates = getDuplicateKeys([
      { key: 'A', value: '1' },
      { key: '', value: '' },
      { key: 'B', value: '2' },
      { key: 'A', value: '3' },
      { key: '', value: 'x' }
    ]);

    expect([...duplicates]).toEqual(['A']);
  });
});

describe('insertKeyValueEntries', () => {
  let pasted = [
    { key: 'X', value: '1' },
    { key: 'Y', value: '2' }
  ];

  it('replaces an empty target row', () => {
    let result = insertKeyValueEntries(
      [
        { key: 'A', value: 'a' },
        { key: '', value: '' },
        { key: 'B', value: 'b' }
      ],
      1,
      pasted
    );

    expect(result.entries.map(entry => entry.key)).toEqual(['A', 'X', 'Y', 'B']);
    expect(result.truncated).toBe(false);
  });

  it('inserts after a filled target row', () => {
    let result = insertKeyValueEntries([{ key: 'A', value: 'a' }], 0, pasted);

    expect(result.entries.map(entry => entry.key)).toEqual(['A', 'X', 'Y']);
  });

  it('truncates to the row limit', () => {
    let result = insertKeyValueEntries([{ key: 'A', value: 'a' }], 0, pasted, 2);

    expect(result.entries.map(entry => entry.key)).toEqual(['A', 'X']);
    expect(result.truncated).toBe(true);
  });
});

describe('keyValueEntriesToRecord', () => {
  it('drops empty keys and lets later duplicates win', () => {
    expect(
      keyValueEntriesToRecord([
        { key: ' A ', value: '1' },
        { key: '', value: 'ignored' },
        { key: 'A', value: '2' }
      ])
    ).toEqual({ A: '2' });
  });
});
