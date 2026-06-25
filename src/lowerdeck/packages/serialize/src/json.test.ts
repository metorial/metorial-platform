import { describe, expect, test } from 'vitest';
import { serialize } from './json';

describe('serialize', () => {
  test('encode should return encoded data', () => {
    let data = { foo: 'bar' };
    let result = serialize.encode(data);

    expect(JSON.parse(result)).toEqual({
      $$TYPES$$: {
        __mode: 'object'
      },
      value: undefined,
      foo: 'bar'
    });
  });

  test('decode should return decoded data', () => {
    let data = {
      $$TYPES$$: {
        __mode: 'object'
      },
      value: undefined,
      foo: 'bar'
    };
    let result = serialize.decode(data);

    expect(result).toEqual({ foo: 'bar' });
  });
});
