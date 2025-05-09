import { describe, expect, it } from 'vitest';
import { metorialDate, metorialDateOptional } from './date';

describe('metorialDate', () => {
  it('should return a Date object for a valid string date', () => {
    const date = metorialDate('2023-01-01');
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should return a Date object for a valid number timestamp', () => {
    const date = metorialDate(1672531200000);
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should return a Date object for null', () => {
    const date = metorialDate(null);
    expect(date).toBeInstanceOf(Date);
    expect(date.getTime()).toBe(0);
  });

  it('should return a Date object for undefined', () => {
    const date = metorialDate(undefined);
    expect(date).toBeInstanceOf(Date);
    expect(date.getTime()).toBe(0);
  });
});

describe('metorialDateOptional', () => {
  it('should return a Date object for a valid string date', () => {
    const date = metorialDateOptional('2023-01-01');
    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should return a Date object for a valid number timestamp', () => {
    const date = metorialDateOptional(1672531200000);
    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should return null for null', () => {
    const date = metorialDateOptional(null);
    expect(date).toBeNull();
  });

  it('should return null for undefined', () => {
    const date = metorialDateOptional(undefined);
    expect(date).toBeNull();
  });
});
