import { describe, expect, test } from 'vitest';
import { canonicalize } from './canonicalize';

describe('canonicalize', () => {
  test('basic values', async () => {
    expect(canonicalize('test')).toBe('"test"');
    expect(canonicalize(1)).toBe('1');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(false)).toBe('false');
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize(undefined)).toBe('null');
  });

  test('arrays', async () => {
    expect(canonicalize(['test', 1, true, false, null, undefined])).toBe(
      '["test",1,true,false,null,null]'
    );
  });

  test('objects', async () => {
    expect(
      canonicalize({
        test: 'test',
        1: 1,
        true: true,
        false: false,
        null: null
      })
    ).toBe('{"1":1,"false":false,"null":null,"test":"test","true":true}');
  });

  test('nested objects', async () => {
    expect(
      canonicalize({
        e: 'test',

        f: {
          h: {
            i: 'test',
            g: [1, '2']
          },
          g: [1, '2']
        },

        a: {
          d: 'test',

          b: {
            c: 'test',
            d: 'test'
          }
        }
      })
    ).toBe(
      '{"a":{"b":{"c":"test","d":"test"},"d":"test"},"e":"test","f":{"g":[1,"2"],"h":{"g":[1,"2"],"i":"test"}}}'
    );
  });
});
