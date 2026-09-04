import { describe, expect, it } from 'vitest';
import { prepareMatchers } from './triggerRoutingMatcherSerialize';

let hashOf = async (matcher: Record<string, any>) => {
  let [prepared] = await prepareMatchers([matcher]);
  return prepared?.hash;
};

describe('prepareMatchers', () => {
  it('hashes independently of key order', async () => {
    expect(await hashOf({ team_id: 'T123', enterprise_id: 'E123' })).toBe(
      await hashOf({ enterprise_id: 'E123', team_id: 'T123' })
    );
  });

  it('hashes nested objects and arrays', async () => {
    expect(await hashOf({ a: { b: ['x', 'y'] } })).toBe(await hashOf({ a: { b: ['x', 'y'] } }));
    expect(await hashOf({ a: { b: ['x', 'y'] } })).not.toBe(
      await hashOf({ a: { b: ['y', 'x'] } })
    );
    expect(await hashOf({ a: { b: 1 } })).not.toBe(await hashOf({ 'a.b': 1 }));
  });

  it('drops matchers that carry no values', async () => {
    expect(await prepareMatchers([{}])).toEqual([]);
    expect(await prepareMatchers([{ a: {} }, { a: [] }, { a: { b: {} } }])).toEqual([]);
    expect(await prepareMatchers([null as any, undefined as any, 'nope' as any])).toEqual([]);
    expect(await prepareMatchers(null)).toEqual([]);
    expect(await prepareMatchers([])).toEqual([]);
  });

  it('keeps matchers whose values are falsy but present', async () => {
    expect(await prepareMatchers([{ a: null }])).toHaveLength(1);
    expect(await prepareMatchers([{ a: false }])).toHaveLength(1);
    expect(await prepareMatchers([{ a: '' }])).toHaveLength(1);
  });

  it('distinguishes strings from numbers', async () => {
    expect(await hashOf({ portal_id: '12345' })).not.toBe(await hashOf({ portal_id: 12345 }));
  });

  it('does not treat a subset as equal to a superset', async () => {
    expect(await hashOf({ a: 'b' })).not.toBe(await hashOf({ a: 'b', c: 'd' }));
    expect(await hashOf({ a: 'b', c: 'f' })).not.toBe(await hashOf({ a: 'b', c: 'd' }));
  });

  it('dedupes matchers by hash and keeps the raw values', async () => {
    let prepared = await prepareMatchers([
      { team_id: 'T123', user_id: 'U123' },
      { user_id: 'U123', team_id: 'T123' },
      { team_id: 'T999' }
    ]);

    expect(prepared).toHaveLength(2);
    expect(prepared[0]!.values).toEqual({ team_id: 'T123', user_id: 'U123' });
    expect(prepared[1]!.values).toEqual({ team_id: 'T999' });
  });
});
