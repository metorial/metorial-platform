import { describe, expect, it } from 'vitest';
import {
  buildUsage,
  decimalCost,
  errorFromStatus,
  microsToDecimal,
  nativeLabel,
  normalizeEffort,
  normalizeProvider,
  normalizeSpeed,
  own,
  usdCost
} from '../src/values';

describe('buildUsage', () => {
  it('records exact components with a reported total', () => {
    let { usage, derived, warnings } = buildUsage({
      inputUncached: 100,
      cacheRead: 50,
      cacheWrite: 25,
      output: 10,
      totalReported: 185
    });

    expect(usage).toEqual({
      provenance: 'exact',
      input_uncached: 100,
      cache_read: 50,
      cache_write: 25,
      output: 10,
      total_reported: 185
    });
    expect(derived).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('derives uncached input from input including cache', () => {
    let { usage, derived } = buildUsage({
      inputIncludingCache: 150,
      cacheRead: 50,
      output: 5
    });

    expect(usage).toMatchObject({
      input_uncached: 100,
      cache_read: 50,
      provenance: 'derived'
    });
    expect(derived).toEqual(['usage.input_uncached']);
  });

  it('derives output from output including reasoning', () => {
    let { usage, derived } = buildUsage({
      inputUncached: 1,
      outputIncludingReasoning: 30,
      reasoning: 12
    });

    expect(usage).toMatchObject({ output: 18, reasoning: 12, provenance: 'derived' });
    expect(derived).toEqual(['usage.output']);
  });

  it('does not derive when the explicit component is present', () => {
    let { usage, derived } = buildUsage({
      inputUncached: 7,
      inputIncludingCache: 500,
      output: 3,
      outputIncludingReasoning: 99
    });

    expect(usage).toMatchObject({ input_uncached: 7, output: 3, provenance: 'exact' });
    expect(derived).toEqual([]);
  });

  it('warns instead of deriving a negative remainder', () => {
    let { usage, warnings } = buildUsage({
      inputIncludingCache: 10,
      cacheRead: 20,
      outputIncludingReasoning: 1,
      reasoning: 5,
      output: undefined
    });

    expect(warnings).toEqual(['usage_negative:input_uncached', 'usage_negative:output']);
    expect(usage).toMatchObject({ cache_read: 20, reasoning: 5 });
    expect(usage).not.toHaveProperty('input_uncached');
    expect(usage).not.toHaveProperty('output');
  });

  it('drops negative components', () => {
    let { usage } = buildUsage({ inputUncached: -1, output: 4 });

    expect(usage).toEqual({ provenance: 'exact', output: 4 });
  });

  it('flags unaccounted tokens against the reported total', () => {
    let { usage } = buildUsage({ inputUncached: 10, output: 5, totalReported: 40 });

    expect(usage?.unaccounted).toBe(25);
  });

  it('excludes reasoning and cache write breakdowns from the accounted sum', () => {
    let { usage } = buildUsage({
      inputUncached: 10,
      cacheWrite: 20,
      cacheWrite5m: 15,
      cacheWrite1h: 5,
      output: 30,
      reasoning: 7,
      totalReported: 67
    });

    expect(usage?.unaccounted).toBeUndefined();
  });

  it('omits unaccounted when the total is lower or equal', () => {
    expect(buildUsage({ inputUncached: 10, totalReported: 5 }).usage).not.toHaveProperty(
      'unaccounted'
    );
    expect(buildUsage({ inputUncached: 10, totalReported: 10 }).usage).not.toHaveProperty(
      'unaccounted'
    );
  });

  it('keeps a total-only usage and marks it partial', () => {
    let { usage } = buildUsage({ totalReported: 99 });

    expect(usage).toEqual({ provenance: 'partial', total_reported: 99 });
  });

  it('keeps a requested provenance', () => {
    expect(buildUsage({ output: 1, provenance: 'aggregate' }).usage?.provenance).toBe(
      'aggregate'
    );
    expect(buildUsage({ totalReported: 1, provenance: 'aggregate' }).usage?.provenance).toBe(
      'aggregate'
    );
  });

  it('returns no usage when nothing usable is present', () => {
    expect(buildUsage({}).usage).toBeUndefined();
    expect(buildUsage({ output: -1, totalReported: -1 }).usage).toBeUndefined();
  });

  it('preserves zeros', () => {
    expect(buildUsage({ output: 0, inputUncached: 0 }).usage).toEqual({
      provenance: 'exact',
      input_uncached: 0,
      output: 0
    });
  });
});

describe('microsToDecimal', () => {
  it.each([
    [0, '0'],
    [1, '0.000001'],
    [1_500_000, '1.5'],
    [1_000_000, '1'],
    [123_456_789, '123.456789'],
    [-2_500_000, '-2.5'],
    [-1, '-0.000001'],
    [10, '0.00001'],
    [1.9, '0.000001']
  ])('formats %d micros as %s', (micros, expected) => {
    expect(microsToDecimal(micros)).toBe(expected);
  });

  it('does not lose precision for large safe integers', () => {
    expect(microsToDecimal(Number.MAX_SAFE_INTEGER)).toBe('9007199254.740991');
  });
});

describe('usdCost', () => {
  it('prefers micros', () => {
    expect(usdCost({ micros: 2_500_000, usd: 99 }, 'billed')).toEqual({
      amount: '2.5',
      unit: 'usd',
      basis: 'billed'
    });
  });

  it('falls back to usd when micros are unusable', () => {
    expect(usdCost({ micros: -1, usd: 0.25 }, 'client_estimate')?.amount).toBe('0.25');
    expect(usdCost({ micros: 1.5, usd: 3 }, 'client_estimate')?.amount).toBe('3');
    expect(usdCost({ micros: 2 ** 60, usd: 1 }, 'client_estimate')?.amount).toBe('1');
  });

  it('formats decimals without trailing zeros or scientific notation', () => {
    expect(usdCost({ usd: 0.1 + 0.2 }, 'server_estimate')?.amount).toBe('0.3');
    expect(usdCost({ usd: 1e-7 }, 'server_estimate')?.amount).toBe('0.0000001');
    expect(usdCost({ usd: 12 }, 'server_estimate')?.amount).toBe('12');
    expect(usdCost({ usd: 0 }, 'server_estimate')?.amount).toBe('0');
  });

  it('rejects negative and non-finite amounts', () => {
    expect(usdCost({ usd: -1 }, 'billed')).toBeUndefined();
    expect(usdCost({ usd: NaN }, 'billed')).toBeUndefined();
    expect(usdCost({ usd: Infinity }, 'billed')).toBeUndefined();
    expect(usdCost({}, 'billed')).toBeUndefined();
  });

  it('carries flags', () => {
    expect(
      usdCost({ usd: 1 }, 'billed', { repeats_parent: true, arrives_late: true })
    ).toEqual({
      amount: '1',
      unit: 'usd',
      basis: 'billed',
      repeats_parent: true,
      arrives_late: true
    });
  });
});

describe('decimalCost', () => {
  it.each(['0', '1', '1.5', '123456789012345678', '0.000000000000000001'])(
    'accepts %s',
    amount => {
      expect(decimalCost(amount, 'billed')?.amount).toBe(amount);
    }
  );

  it.each([
    undefined,
    '',
    '-1',
    '1e5',
    '1.',
    '.5',
    ' 1',
    '1 ',
    'NaN',
    '1234567890123456789',
    '1.1234567890123456789',
    '1,5'
  ])('rejects %j', amount => {
    expect(decimalCost(amount, 'billed')).toBeUndefined();
  });
});

describe('nativeLabel', () => {
  it('trims, clamps and rejects non-strings', () => {
    expect(nativeLabel('  hi ')).toBe('hi');
    expect(nativeLabel('x'.repeat(100))).toHaveLength(64);
    expect(nativeLabel('   ')).toBeUndefined();
    expect(nativeLabel('')).toBeUndefined();
    expect(nativeLabel(5)).toBeUndefined();
    expect(nativeLabel(null)).toBeUndefined();
    expect(nativeLabel({})).toBeUndefined();
  });
});

describe('errorFromStatus', () => {
  it.each([
    [401, 'auth', false],
    [403, 'auth', false],
    [429, 'rate_limit', true],
    [529, 'overloaded', true],
    [503, 'overloaded', true],
    [408, 'timeout', true],
    [504, 'timeout', true],
    [400, 'invalid_request', false],
    [404, 'invalid_request', false],
    [413, 'invalid_request', false],
    [422, 'invalid_request', false],
    [500, 'server', true],
    [502, 'server', true],
    [0, 'network', true]
  ] as const)('maps status %d', (status, errorClass, retryable) => {
    let info = errorFromStatus(status);

    expect(info.class).toBe(errorClass);
    expect(info.status_code).toBe(status);
    expect(info.retryable).toBe(retryable ? true : undefined);
  });

  it('uses the fallback for unclassified statuses', () => {
    expect(errorFromStatus(undefined)).toEqual({ class: 'unknown' });
    expect(errorFromStatus(418)).toEqual({ class: 'unknown', status_code: 418 });
    expect(errorFromStatus(undefined, undefined, 'tool')).toEqual({ class: 'tool' });
  });

  it.each([
    ['context_length_exceeded', 'context_length'],
    ['rate_limit_error', 'rate_limit'],
    ['overloaded_error', 'overloaded'],
    ['request_timeout', 'timeout'],
    ['timed_out', 'timeout'],
    ['authentication_error', 'auth']
  ])('classifies the native type %s', (nativeType, expected) => {
    expect(errorFromStatus(undefined, nativeType).class).toBe(expected);
  });

  it('lets the native type win over the status', () => {
    expect(errorFromStatus(500, 'rate_limit_error').class).toBe('rate_limit');
  });

  it('keeps the native type, clamped', () => {
    expect(errorFromStatus(500, 'x'.repeat(100)).native_type).toHaveLength(64);
    expect(errorFromStatus(500, '  ').native_type).toBeUndefined();
  });

  it('omits fractional status codes', () => {
    expect(errorFromStatus(500.5).status_code).toBeUndefined();
  });
});

describe('normalizeEffort', () => {
  it('passes known values case-insensitively', () => {
    expect(normalizeEffort('HIGH')).toBe('high');
    expect(normalizeEffort(' none ')).toBe('none');
  });

  it('slugs unknown values', () => {
    expect(normalizeEffort('X High!')).toBe('other:x_high_');
    expect(normalizeEffort('x'.repeat(100))).toBe(`other:${'x'.repeat(32)}`);
  });

  it('returns undefined for empty input', () => {
    expect(normalizeEffort(undefined)).toBeUndefined();
    expect(normalizeEffort('')).toBeUndefined();
    expect(normalizeEffort('   ')).toBeUndefined();
  });
});

describe('normalizeSpeed', () => {
  it('only accepts standard and fast', () => {
    expect(normalizeSpeed('FAST')).toBe('fast');
    expect(normalizeSpeed(' standard ')).toBe('standard');
    expect(normalizeSpeed('turbo')).toBeUndefined();
    expect(normalizeSpeed(undefined)).toBeUndefined();
  });
});

describe('normalizeProvider', () => {
  it('passes known providers', () => {
    expect(normalizeProvider('Anthropic')).toBe('anthropic');
    expect(normalizeProvider('bedrock')).toBe('bedrock');
  });

  it('maps aliases', () => {
    expect(normalizeProvider('aws.bedrock')).toBe('bedrock');
    expect(normalizeProvider('gcp.vertex_ai')).toBe('vertex');
    expect(normalizeProvider('foundry')).toBe('azure');
  });

  it('prefixes unknown providers', () => {
    expect(normalizeProvider('My Provider')).toBe('other:my_provider');
    expect(normalizeProvider('x'.repeat(80))).toBe(`other:${'x'.repeat(32)}`);
  });

  it('returns undefined for empty input', () => {
    expect(normalizeProvider(undefined)).toBeUndefined();
    expect(normalizeProvider('')).toBeUndefined();
    expect(normalizeProvider('  ')).toBeUndefined();
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'treats the object property name %s as an unknown provider',
    name => {
      expect(normalizeProvider(name)).toBe(`other:${name.toLowerCase()}`);
    }
  );
});

describe('own', () => {
  let table: Record<string, number> = { a: 1, zero: 0 };

  it('reads own properties only', () => {
    expect(own(table, 'a')).toBe(1);
    expect(own(table, 'zero')).toBe(0);
    expect(own(table, 'b')).toBeUndefined();
    expect(own(table, undefined)).toBeUndefined();
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
    'does not resolve the inherited name %s',
    key => {
      expect(own(table, key)).toBeUndefined();
    }
  );
});
