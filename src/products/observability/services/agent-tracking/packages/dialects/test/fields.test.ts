import { describe, expect, it } from 'vitest';
import { FieldReader, readFields } from '../src/fields';

let reader = (source: Record<string, unknown>) => new FieldReader(source, 'x.');

describe('FieldReader.str', () => {
  it('returns non-empty strings only', () => {
    let fields = reader({ a: 'x', b: '', c: 1, d: null, e: ['x'] });

    expect(fields.str('a')).toBe('x');
    expect(fields.str('b')).toBeUndefined();
    expect(fields.str('c')).toBeUndefined();
    expect(fields.str('d')).toBeUndefined();
    expect(fields.str('e')).toBeUndefined();
    expect(fields.str('missing')).toBeUndefined();
  });

  it('uses the first present key, skipping null and undefined', () => {
    let fields = reader({ a: null, b: undefined, c: 'third', d: 'fourth' });

    expect(fields.str('a', 'b', 'c', 'd')).toBe('third');
  });

  it('does not fall through a present value of the wrong type', () => {
    expect(reader({ a: 5, b: 'later' }).str('a', 'b')).toBeUndefined();
  });

  it('ignores inherited properties', () => {
    expect(reader({}).str('constructor')).toBeUndefined();
    expect(reader({}).str('toString', '__proto__')).toBeUndefined();
  });
});

describe('FieldReader.text', () => {
  it('stringifies finite numbers and records coercion', () => {
    let fields = reader({ a: 12, b: 'x' });

    expect(fields.text('a')).toBe('12');
    expect(fields.text('b')).toBe('x');
    expect(fields.coerced).toEqual(['x.a']);
  });

  it('rejects non-finite numbers, empty strings and objects', () => {
    let fields = reader({ a: NaN, b: Infinity, c: '', d: {}, e: true });

    for (let key of ['a', 'b', 'c', 'd', 'e']) expect(fields.text(key)).toBeUndefined();

    expect(fields.coerced).toEqual([]);
  });
});

describe('FieldReader.num', () => {
  it('passes finite numbers without coercion', () => {
    let fields = reader({ a: 3.5, b: -2, c: 0 });

    expect([fields.num('a'), fields.num('b'), fields.num('c')]).toEqual([3.5, -2, 0]);
    expect(fields.coerced).toEqual([]);
  });

  it.each([
    ['42', 42],
    [' 42 ', 42],
    ['-1.5', -1.5],
    ['+3', 3],
    ['.5', 0.5],
    ['5.', 5],
    ['1e3', 1000],
    ['1E-2', 0.01]
  ])('coerces the numeric string %j', (text, expected) => {
    let fields = reader({ a: text });

    expect(fields.num('a')).toBe(expected);
    expect(fields.coerced).toEqual(['x.a']);
  });

  it.each(['', ' ', 'abc', '0x10', '1,5', '1e', 'Infinity', 'NaN', '--1', '1 2', '1e999'])(
    'rejects the string %j',
    text => {
      expect(reader({ a: text }).num('a')).toBeUndefined();
    }
  );

  it('rejects non-finite numbers and other types', () => {
    let fields = reader({ a: NaN, b: Infinity, c: true, d: [1], e: {} });

    for (let key of ['a', 'b', 'c', 'd', 'e']) expect(fields.num(key)).toBeUndefined();
  });

  it('deduplicates coerced keys', () => {
    let fields = reader({ a: '1' });

    fields.num('a');
    fields.num('a');

    expect(fields.coerced).toEqual(['x.a']);
  });
});

describe('FieldReader.int and count', () => {
  it('truncates toward zero', () => {
    let fields = reader({ a: 3.9, b: -3.9 });

    expect(fields.int('a')).toBe(3);
    expect(fields.int('b')).toBe(-3);
  });

  it('rejects unsafe integers', () => {
    let fields = reader({ a: 1e300, b: Number.MAX_SAFE_INTEGER + 2, c: '9007199254740993' });

    expect(fields.int('a')).toBeUndefined();
    expect(fields.int('b')).toBeUndefined();
    expect(fields.int('c')).toBeUndefined();
  });

  it('counts only non-negative integers', () => {
    let fields = reader({ a: 0, b: -1, c: '7', d: 2.5, e: -0.5 });

    expect(fields.count('a')).toBe(0);
    expect(fields.count('b')).toBeUndefined();
    expect(fields.count('c')).toBe(7);
    expect(fields.count('d')).toBe(2);
    expect(fields.count('e') === 0).toBe(true);
  });
});

describe('FieldReader.bool', () => {
  it('accepts booleans and the strings true and false', () => {
    let fields = reader({ a: true, b: false, c: 'true', d: 'false' });

    expect([fields.bool('a'), fields.bool('b'), fields.bool('c'), fields.bool('d')]).toEqual([
      true,
      false,
      true,
      false
    ]);
    expect(fields.coerced.sort()).toEqual(['x.c', 'x.d']);
  });

  it.each(['TRUE', 'yes', '1', 1, 0, '', {}])('rejects %j', value => {
    expect(reader({ a: value }).bool('a')).toBeUndefined();
  });
});

describe('FieldReader.obj, raw and has', () => {
  it('returns plain objects only', () => {
    let nested = { a: 1 };
    let fields = reader({ a: nested, b: [1], c: 'x', d: null });

    expect(fields.obj('a')).toBe(nested);
    expect(fields.obj('b')).toBeUndefined();
    expect(fields.obj('c')).toBeUndefined();
    expect(fields.obj('d')).toBeUndefined();
  });

  it('exposes raw values and presence', () => {
    let fields = reader({ a: 0, b: '', c: null, d: undefined });

    expect(fields.raw('a')).toBe(0);
    expect(fields.raw('b')).toBe('');
    expect(fields.raw('c')).toBeUndefined();
    expect(fields.has('a')).toBe(true);
    expect(fields.has('b')).toBe(true);
    expect(fields.has('c', 'd')).toBe(false);
    expect(fields.has('c', 'a')).toBe(true);
  });

  it('is created through readFields with a label', () => {
    let fields = readFields({ n: '5' }, 'metric.');

    fields.num('n');

    expect(fields.coerced).toEqual(['metric.n']);
  });
});
