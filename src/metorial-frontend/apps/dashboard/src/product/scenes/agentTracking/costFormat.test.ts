import { describe, expect, it } from 'vitest';
import { formatAmount, formatCost } from './costFormat';

describe('formatCost', () => {
  it('marks estimates with a tilde', () => {
    expect(formatCost('3.735338', { estimate: true })).toBe('~$3.74');
    expect(formatCost('3.735338', { estimate: false })).toBe('$3.74');
  });

  it('keeps a below-a-cent amount as a single bound without the tilde', () => {
    expect(formatCost('0.004132', { estimate: true })).toBe('<$0.01');
    expect(formatCost('0.004132', { estimate: false })).toBe('<$0.01');
    expect(formatAmount('-0.001', { estimate: true })).toBe('>-$0.01');
  });

  it('leaves zero and missing amounts alone', () => {
    expect(formatCost('0', { estimate: true })).toBe('~$0.00');
    expect(formatCost(null, { estimate: true })).toBeNull();
  });
});
