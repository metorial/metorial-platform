import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  cursorPredicate,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  parseRowsCursor,
  serializeRowsCursor
} from '../src/lib/rows';

let key = Buffer.from('k'.repeat(32));

describe('rows cursors', () => {
  it('round-trips dates and decimals', () => {
    let at = new Date('2026-11-10T09:00:00.123Z');
    let token = encodeCursor({ value: at, id: 's1' }, { key, queryHash: 'q' });

    expect(decodeCursor(token, { key, queryHash: 'q' })).toEqual({ value: at, id: 's1' });

    let decimal = mongoose.mongo.Decimal128.fromString('1.25');
    let decoded = decodeCursor(
      encodeCursor({ value: decimal, id: 's2' }, { key, queryHash: 'q' }),
      {
        key,
        queryHash: 'q'
      }
    );
    expect(String(decoded.value)).toBe('1.25');
  });

  it('rejects tampered, foreign and malformed cursors', () => {
    let token = encodeCursor({ value: 1, id: 's1' }, { key, queryHash: 'q' });
    let [payload] = token.split('.');

    expect(() => decodeCursor(`${payload}.forged`, { key, queryHash: 'q' })).toThrow(
      InvalidCursorError
    );
    expect(() =>
      decodeCursor(token, { key: Buffer.from('x'.repeat(32)), queryHash: 'q' })
    ).toThrow(InvalidCursorError);
    expect(() => decodeCursor(token, { key, queryHash: 'other' })).toThrow('another query');
    expect(() => decodeCursor('garbage', { key, queryHash: 'q' })).toThrow(InvalidCursorError);
  });

  it('serializes export checkpoints without a signature', () => {
    let at = new Date('2026-11-10T09:00:00Z');
    expect(parseRowsCursor(serializeRowsCursor({ value: at, id: 'r1' }))).toEqual({
      value: at,
      id: 'r1'
    });
    expect(parseRowsCursor(serializeRowsCursor({ value: null, id: 'r2' }))).toEqual({
      value: null,
      id: 'r2'
    });
  });

  it('continues strictly after the cursor in either direction', () => {
    let at = new Date('2026-11-10T09:00:00Z');

    expect(
      cursorPredicate({ path: 'occurredAt', direction: 'asc' }, { value: at, id: 'r1' })
    ).toEqual({
      t: 'or',
      items: [
        { t: 'cmp', path: 'occurredAt', op: 'gt', value: at },
        {
          t: 'and',
          items: [
            { t: 'cmp', path: 'occurredAt', op: 'eq', value: at },
            { t: 'cmp', path: '_id', op: 'gt', value: 'r1' }
          ]
        },
        { t: 'null', path: 'occurredAt' }
      ]
    });

    expect(
      cursorPredicate({ path: 'cost', direction: 'desc' }, { value: null, id: 'r9' })
    ).toEqual({
      t: 'and',
      items: [
        { t: 'null', path: 'cost' },
        { t: 'cmp', path: '_id', op: 'lt', value: 'r9' }
      ]
    });
  });
});
