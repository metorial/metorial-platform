import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent
} from './format';

describe('formatBytes', () => {
  it('uses binary units by default', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KiB');
    expect(formatBytes(1.3 * 1024 ** 3)).toBe('1.3 GiB');
    expect(formatBytes(4 * 1024 ** 3)).toBe('4 GiB');
  });

  it('uses SI units for base 1000', () => {
    expect(formatBytes(48_000_000, { base: 1000 })).toBe('48 MB');
    expect(formatBytes(6_100_000, { base: 1000 })).toBe('6.1 MB');
    expect(formatBytes(1_200_000_000, { base: 1000 })).toBe('1.2 GB');
  });

  it('moves to the next unit when rounding reaches the base', () => {
    expect(formatBytes(1023.97 * 1024)).toBe('1 MiB');
    expect(formatBytes(999_960, { base: 1000 })).toBe('1 MB');
  });

  it('respects precision and handles negatives and invalid values', () => {
    expect(formatBytes(1.2345 * 1024 ** 2, { precision: 2 })).toBe('1.23 MiB');
    expect(formatBytes(-2048)).toBe('-2 KiB');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('formats with up to two fraction digits by default', () => {
    expect(formatNumber(0.8412)).toBe('0.84');
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(12345.678)).toBe('12,345.68');
  });

  it('supports precision, compact notation and units', () => {
    expect(formatNumber(1.94, { precision: 1 })).toBe('1.9');
    expect(formatNumber(1_200_000, { compact: true })).toBe('1.2M');
    expect(formatNumber(2, { unit: 'vCPU' })).toBe('2 vCPU');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('treats input as a ratio by default', () => {
    expect(formatPercent(0.42)).toBe('42%');
    expect(formatPercent(0.4256)).toBe('42.6%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('accepts percent-scaled input', () => {
    expect(formatPercent(42, { scale: 'percent' })).toBe('42%');
    expect(formatPercent(42.567, { scale: 'percent', precision: 0 })).toBe('43%');
  });
});

describe('formatDuration', () => {
  it('shows the two largest consecutive units', () => {
    expect(formatDuration((18 * 60 + 12) * 60_000 + 59_000)).toBe('18h 12m');
    expect(formatDuration(65_000)).toBe('1m 5s');
    expect(formatDuration(2 * 86_400_000 + 4 * 3_600_000)).toBe('2d 4h');
    expect(formatDuration(3_600_000)).toBe('1h');
  });

  it('stops at a zero unit instead of skipping it', () => {
    expect(formatDuration(86_400_000 + 5 * 60_000)).toBe('1d');
  });

  it('handles sub-second values, seconds input and the unit limit', () => {
    expect(formatDuration(350)).toBe('350ms');
    expect(formatDuration(90, { unit: 's' })).toBe('1m 30s');
    expect(formatDuration(5 * 60_000, { units: 1 })).toBe('5m');
    expect(formatDuration(Number.NaN)).toBe('—');
  });
});

describe('formatCurrency', () => {
  it('rounds decimal strings to cents on their digits', () => {
    expect(formatCurrency('12.345678901')).toBe('$12.35');
    expect(formatCurrency('12.344999999')).toBe('$12.34');
    expect(formatCurrency('0.005')).toBe('$0.01');
    expect(formatCurrency('999.995')).toBe('$1,000.00');
    expect(formatCurrency('1234567.891')).toBe('$1,234,567.89');
    expect(formatCurrency('7')).toBe('$7.00');
    expect(formatCurrency('.5')).toBe('$0.50');
  });

  it('keeps zero apart from amounts too small to show', () => {
    expect(formatCurrency('0')).toBe('$0.00');
    expect(formatCurrency('0.000000000')).toBe('$0.00');
    expect(formatCurrency('0.004')).toBe('<$0.01');
    expect(formatCurrency('0.000000001')).toBe('<$0.01');
    expect(formatCurrency('-0.004')).toBe('>-$0.01');
  });

  it('supports a finer precision for small amounts', () => {
    expect(formatCurrency('0.0034567', { precision: 4 })).toBe('$0.0035');
    expect(formatCurrency('0.00001', { precision: 4 })).toBe('<$0.0001');
    expect(formatCurrency('12.5', { precision: 0 })).toBe('$13');
  });

  it('accepts numbers without float noise', () => {
    expect(formatCurrency(0.1 + 0.2)).toBe('$0.30');
    expect(formatCurrency(1.005)).toBe('$1.01');
    expect(formatCurrency(-3.5)).toBe('-$3.50');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats compact amounts for chart axes', () => {
    expect(formatCurrency(1200, { compact: true })).toBe('$1.2K');
    expect(formatCurrency(0.25, { compact: true })).toBe('$0.25');
    expect(formatCurrency(0.5, { compact: true })).toBe('$0.50');
    expect(formatCurrency(999.5, { compact: true })).toBe('$999.50');
    expect(formatCurrency(0, { compact: true })).toBe('$0.00');
    expect(formatCurrency(-2500, { compact: true })).toBe('-$2.5K');
  });

  it('falls back to the currency code and rejects invalid input', () => {
    expect(formatCurrency('5', { currency: 'eur' })).toBe('5.00 EUR');
    expect(formatCurrency('abc')).toBe('—');
    expect(formatCurrency('')).toBe('—');
    expect(formatCurrency('1e5')).toBe('—');
    expect(formatCurrency(Number.NaN)).toBe('—');
  });
});
