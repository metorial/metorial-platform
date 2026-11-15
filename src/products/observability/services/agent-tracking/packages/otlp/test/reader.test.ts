import { describe, expect, it } from 'vitest';
import { OtlpDecodeError } from '../src/model';
import { Reader } from '../src/reader';
import {
  concat,
  doubleField,
  fixed64Field,
  lengthDelimited,
  stringField,
  tag,
  varint,
  varintField
} from '@mtsrc/agent-tracking-testing';

let bytes = (...values: number[]) => Uint8Array.from(values);

describe('Reader', () => {
  it('reads tags', () => {
    let reader = new Reader(concat(varintField(5, 1), stringField(1536, 'x')));

    expect(reader.next()).toBe(true);
    expect([reader.field, reader.wire]).toEqual([5, 0]);

    reader.skip();

    expect(reader.next()).toBe(true);
    expect([reader.field, reader.wire]).toEqual([1536, 2]);
    expect(reader.string()).toBe('x');
    expect(reader.next()).toBe(false);
  });

  it.each([
    [[0x00], 0],
    [[0x7f], 127],
    [[0x80, 0x01], 128],
    [[0xff, 0xff, 0xff, 0xff, 0x0f], 0xffffffff]
  ])('reads varint32 %j', (input, expected) => {
    expect(new Reader(bytes(...input)).varint32()).toBe(expected);
  });

  it('rejects overlong and truncated varints', () => {
    expect(() => new Reader(bytes(0xff, 0xff, 0xff, 0xff, 0xff)).varint32()).toThrow(
      'varint too long'
    );
    expect(() => new Reader(bytes(0x80, 0x80)).varint32()).toThrow('truncated varint');
    expect(() => new Reader(new Uint8Array()).varint32()).toThrow('truncated varint');
  });

  it('reads 64-bit varints and wraps to unsigned 64 bits', () => {
    expect(new Reader(varint(2n ** 64n - 1n)).varintBig()).toBe(2n ** 64n - 1n);
    expect(new Reader(varint(-1)).varintBig()).toBe(2n ** 64n - 1n);
    expect(new Reader(varint(300)).varintBig()).toBe(300n);
  });

  it('rejects an 11-byte varint', () => {
    expect(() => new Reader(new Uint8Array(11).fill(0xff)).varintBig()).toThrow(
      'varint too long'
    );
  });

  it('clamps varintNumber at the safe integer limit', () => {
    expect(new Reader(varint(2n ** 60n)).varintNumber()).toBe(Number.MAX_SAFE_INTEGER);
    expect(new Reader(varint(42)).varintNumber()).toBe(42);
  });

  it('reads fixed-width values', () => {
    let reader = new Reader(
      concat(
        fixed64Field(1, 0x0102030405060708n).subarray(1),
        doubleField(1, 1.5).subarray(1),
        bytes(1, 0, 0, 0)
      )
    );

    expect(reader.fixed64()).toBe(0x0102030405060708n);
    expect(reader.double()).toBe(1.5);
    expect(reader.fixed32()).toBe(1);
  });

  it('rejects truncated fixed-width reads', () => {
    expect(() => new Reader(bytes(1, 2, 3)).fixed64()).toThrow('truncated field');
    expect(() => new Reader(bytes(1, 2, 3)).double()).toThrow('truncated field');
    expect(() => new Reader(bytes(1, 2, 3)).fixed32()).toThrow('truncated field');
  });

  it('bounds nested messages to their declared length', () => {
    let outer = new Reader(concat(lengthDelimited(1, bytes(0x08, 0x01)), bytes(0x10, 0x02)));

    outer.next();

    let inner = outer.message();

    expect(inner.next()).toBe(true);
    inner.skip();
    expect(inner.next()).toBe(false);

    expect(outer.next()).toBe(true);
    expect(outer.field).toBe(2);
  });

  it('rejects lengths beyond the enclosing message', () => {
    expect(() => new Reader(bytes(0x05, 0x01)).bytes()).toThrow('length exceeds message');

    let outer = new Reader(
      concat(lengthDelimited(1, bytes(0x0a, 0x05)), bytes(1, 2, 3, 4, 5, 6))
    );
    outer.next();

    let inner = outer.message();
    inner.next();

    expect(() => inner.bytes()).toThrow('length exceeds message');
  });

  it('rejects field number zero', () => {
    expect(() => new Reader(bytes(0x02)).next()).toThrow('invalid field number');
  });

  it('skips each supported wire type and rejects others', () => {
    let reader = new Reader(
      concat(
        varintField(1, 300),
        fixed64Field(2, 1n),
        lengthDelimited(3, bytes(1, 2)),
        concat(tag(4, 5), bytes(0, 0, 0, 0)),
        tag(5, 3)
      )
    );

    for (let field = 1; field <= 4; field++) {
      expect(reader.next()).toBe(true);
      expect(reader.field).toBe(field);
      reader.skip();
    }

    expect(reader.next()).toBe(true);
    expect(() => reader.skip()).toThrow(OtlpDecodeError);
  });

  it('checks expected wire types', () => {
    let reader = new Reader(varintField(1, 1));
    reader.next();

    expect(() => reader.expect(2)).toThrow('unexpected wire type');
    expect(() => reader.expect(0)).not.toThrow();
  });
});
