import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { ResolvedField } from '../src/catalog';
import { csvCell, exportColumnsOf, gzipMember, serializeRows } from '../src/lib/exportFormat';

let field = (name: string, label?: 'entity'): ResolvedField =>
  ({ name, type: label ? 'id' : 'string', ...(label ? { label } : {}) }) as ResolvedField;

describe('csvCell', () => {
  it('quotes separators, quotes and line breaks', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('defuses text a spreadsheet would run as a formula, but not numbers', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('\rx')).toBe(`"'\rx"`);
    expect(csvCell(-3.5)).toBe('-3.5');
    expect(csvCell(true)).toBe('true');
  });

  it('joins arrays with semicolons and escapes the result', () => {
    expect(csvCell(['a', 'b'])).toBe('a;b');
    expect(csvCell(['=x', 'b'])).toBe("'=x;b");
    expect(csvCell([])).toBe('');
  });
});

describe('serializeRows', () => {
  let columns = exportColumnsOf(
    [field('user', 'entity'), field('tool'), field('repos', 'entity')],
    true
  );
  let labels = {
    user: { u1: { name: 'Ada' } },
    repos: { r1: { name: 'api' }, r2: { name: '=evil' } }
  };
  let rows = [
    { user: 'u1', tool: 'Bash', repos: ['r1', 'r2'] },
    { user: 'u2', tool: null, repos: [] }
  ];

  it('adds a label column beside every labelled id column', () => {
    expect(columns.map(column => column.header)).toEqual([
      'user',
      'user.name',
      'tool',
      'repos',
      'repos.name'
    ]);
    expect(
      exportColumnsOf([field('user', 'entity')], false).map(column => column.header)
    ).toEqual(['user']);
  });

  it('writes CSV with an optional header and CRLF line ends', () => {
    expect(serializeRows({ format: 'csv', columns, rows, labels, header: true })).toBe(
      'user,user.name,tool,repos,repos.name\r\n' +
        'u1,Ada,Bash,r1;r2,api;=evil\r\n' +
        'u2,,,,\r\n'
    );
    expect(serializeRows({ format: 'csv', columns, rows: [], labels, header: false })).toBe(
      ''
    );
  });

  it('writes one JSON object per line', () => {
    let lines = serializeRows({ format: 'ndjson', columns, rows, labels, header: true })
      .trimEnd()
      .split('\n');
    expect(lines.map(line => JSON.parse(line))).toEqual([
      {
        user: 'u1',
        'user.name': 'Ada',
        tool: 'Bash',
        repos: ['r1', 'r2'],
        'repos.name': ['api', '=evil']
      },
      { user: 'u2', 'user.name': null, tool: null, repos: [], 'repos.name': null }
    ]);
  });
});

describe('gzipMember', () => {
  it('produces members that decode as one file when concatenated', () => {
    let parts = ['header\r\n', 'row 1\r\n', '', 'row 2\r\n'];
    let file = Buffer.concat(parts.map(gzipMember));

    expect(gunzipSync(file).toString()).toBe(parts.join(''));
  });
});
