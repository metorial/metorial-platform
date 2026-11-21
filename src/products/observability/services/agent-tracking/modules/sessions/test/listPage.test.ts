import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { sessionPagings, type PositionedSession } from '../src/lib/listPage';

let { lastActivity, cost } = sessionPagings;

let session = (sessionKey: string, costUsd?: string | null) =>
  ({
    _id: sessionKey,
    lastActivityAt: new Date(Date.UTC(2026, 0, 1, 0, 2)),
    summary:
      costUsd === undefined
        ? undefined
        : { costUsd: costUsd === null ? null : mongoose.Types.Decimal128.fromString(costUsd) }
  }) as PositionedSession;

let encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('session list cursor', () => {
  it('round-trips a position', () => {
    let listed = session('c');

    expect(lastActivity.read(lastActivity.cursorOf(listed))).toEqual(
      lastActivity.positionOf(listed)
    );
  });

  it('reads a bare session key or a malformed cursor as no position', () => {
    expect(lastActivity.read('atss_01jexample')).toBeUndefined();
    expect(lastActivity.read('')).toBeUndefined();
    expect(lastActivity.read(encoded('c'))).toBeUndefined();
    expect(lastActivity.read(encoded({ a: 'later', k: 'c' }))).toBeUndefined();
  });
});

describe('session cost cursor', () => {
  it('round-trips a position, including one without a cost', () => {
    for (let listed of [session('a'), session('b', null), session('e', '0.000000125')]) {
      expect(cost.read(cost.cursorOf(listed))).toEqual(cost.positionOf(listed));
    }
  });

  it('does not read a cursor of the other order', () => {
    expect(cost.read(lastActivity.cursorOf(session('c')))).toBeUndefined();
    expect(lastActivity.read(cost.cursorOf(session('c', '0.5')))).toBeUndefined();
  });

  it('rejects a cost that is not a decimal and reads a bare key as no position', () => {
    expect(cost.read(encoded({ s: 'cost', c: 'lots', k: 'c' }))).toBeUndefined();
    expect(cost.read('c0ffee')).toBeUndefined();
  });
});
