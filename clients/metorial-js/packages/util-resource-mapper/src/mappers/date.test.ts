import { describe, expect, it } from 'vitest';
import { dateMapper } from './date';

describe('dateMapper', () => {
  const mapper = dateMapper();

  it('should return the same Date instance for Date input', () => {
    const date = new Date('2023-01-01T00:00:00Z');
    expect(mapper.transformFrom(date)).toBe(date);
    expect(mapper.transformTo(date)).toBe(date);
  });

  it('should convert valid date string to Date', () => {
    const input = '2023-01-01T12:34:56Z';
    const result = mapper.transformFrom(input);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2023-01-01T12:34:56.000Z');
  });

  it('should convert valid timestamp number to Date', () => {
    const timestamp = 1672579200000; // 2023-01-01T00:00:00.000Z
    const result = mapper.transformFrom(timestamp);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(timestamp);
  });

  it('should return input if string is not a valid date', () => {
    const input = 'not-a-date';
    expect(mapper.transformFrom(input)).toBe(input);
  });

  it('should return input if number is not a valid date', () => {
    // NaN date: new Date(NaN) is invalid
    const input = NaN;
    expect(mapper.transformFrom(input)).toBe(input);
  });

  it('should return input for non-date, non-string, non-number types', () => {
    const input = { foo: 'bar' };
    expect(mapper.transformFrom(input)).toBe(input);
    expect(mapper.transformTo(input)).toBe(input);
  });

  it('should work the same for transformTo', () => {
    const dateStr = '2023-01-01T00:00:00Z';
    const dateNum = 1672531200000;
    expect(mapper.transformTo(dateStr)).toBeInstanceOf(Date);
    expect(mapper.transformTo(dateNum)).toBeInstanceOf(Date);
  });
});
