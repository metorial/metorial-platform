import { describe, expect, it } from 'vitest';
import { parsePartialJson } from './partialJson';

describe('parsePartialJson', () => {
  it('parses complete json', () => {
    expect(parsePartialJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('closes an open string value', () => {
    expect(
      parsePartialJson('{"operations":[{"kind":"replace","target":"b2","content":"Hel')
    ).toEqual({
      operations: [{ kind: 'replace', target: 'b2', content: 'Hel' }]
    });
  });

  it('drops a dangling key', () => {
    expect(parsePartialJson('{"kind":"replace","target":"b2","content":')).toEqual({
      kind: 'replace',
      target: 'b2'
    });

    expect(parsePartialJson('{"kind":"replace","tar')).toEqual({ kind: 'replace' });
  });

  it('drops trailing commas and partial literals', () => {
    expect(parsePartialJson('{"a":[1,2,')).toEqual({ a: [1, 2] });
    expect(parsePartialJson('{"a":"x","b":tr')).toEqual({ a: 'x' });
  });

  it('handles escapes at the end of a string', () => {
    expect(parsePartialJson('{"content":"line\\')).toEqual({ content: 'line' });
    expect(parsePartialJson('{"content":"a\\u00')).toEqual({ content: 'a' });
    expect(parsePartialJson('{"content":"a\\"b')).toEqual({ content: 'a"b' });
  });

  it('returns undefined for empty input', () => {
    expect(parsePartialJson('')).toBeUndefined();
  });
});
