import { describe, expect, it } from 'vitest';
import { dollarsOf, formatAmount, formatCost } from './costFormat';

describe('dollarsOf', () => {
  it('writes micro-dollars as exact dollars', () => {
    expect(dollarsOf(12345678)).toBe('12.345678');
    expect(dollarsOf(4132)).toBe('0.004132');
    expect(dollarsOf(-1000)).toBe('-0.001000');
    expect(dollarsOf(0)).toBe('0.000000');
    expect(dollarsOf(9007199254740991)).toBe('9007199254.740991');
  });
});

describe('formatCost', () => {
  it('marks estimates with a tilde', () => {
    expect(formatCost(3735338, { estimate: true })).toBe('~$3.74');
    expect(formatCost(3735338, { estimate: false })).toBe('$3.74');
  });

  it('keeps a below-a-cent amount as a single bound without the tilde', () => {
    expect(formatCost(4132, { estimate: true })).toBe('<$0.01');
    expect(formatCost(4132, { estimate: false })).toBe('<$0.01');
    expect(formatAmount(-1000, { estimate: true })).toBe('>-$0.01');
  });

  it('leaves zero and missing amounts alone', () => {
    expect(formatCost(0, { estimate: true })).toBe('~$0.00');
    expect(formatCost(null, { estimate: true })).toBeNull();
  });
});
