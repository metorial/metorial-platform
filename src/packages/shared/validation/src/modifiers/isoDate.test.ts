import { describe, expect, test } from 'vitest';
import { isoDate, isoDateTime, isoTime } from './isoDate';

describe('isoDate', () => {
  test('should return an empty array if the value is a valid ISO date', () => {
    let result = isoDate()('2022-01-01');
    expect(result).toEqual([]);
  });

  test('should return an error object if the value is not a valid ISO date', () => {
    let result = isoDate()('2022-01-32');
    expect(result).toEqual([
      {
        code: 'invalid_iso_date',
        message: 'Invalid iso date'
      }
    ]);
  });

  test('should return a custom error message if provided', () => {
    let result = isoDate({ message: 'Invalid date format' })('2022-01-32');
    expect(result).toEqual([
      {
        code: 'invalid_iso_date',
        message: 'Invalid date format'
      }
    ]);
  });
});

describe('isoDateTime', () => {
  test('should return an empty array if the value is a valid ISO date time', () => {
    let result = isoDateTime()('2022-01-01T12:30');
    expect(result).toEqual([]);
  });

  test('should return an error object if the value is not a valid ISO date time', () => {
    let result = isoDateTime()('2022-01-32T25:00');
    expect(result).toEqual([
      {
        code: 'invalid_iso_date_time',
        message: 'Invalid iso date time'
      }
    ]);
  });

  test('should return a custom error message if provided', () => {
    let result = isoDateTime({ message: 'Invalid date time format' })('2022-01-32T25:00');
    expect(result).toEqual([
      {
        code: 'invalid_iso_date_time',
        message: 'Invalid date time format'
      }
    ]);
  });
});

describe('isoTime', () => {
  test('should return an empty array if the value is a valid ISO time', () => {
    let result = isoTime()('12:30');
    expect(result).toEqual([]);
  });

  test('should return an error object if the value is not a valid ISO time', () => {
    let result = isoTime()('25:00');
    expect(result).toEqual([
      {
        code: 'invalid_iso_time',
        message: 'Invalid iso time'
      }
    ]);
  });

  test('should return a custom error message if provided', () => {
    let result = isoTime({ message: 'Invalid time format' })('25:00');
    expect(result).toEqual([
      {
        code: 'invalid_iso_time',
        message: 'Invalid time format'
      }
    ]);
  });
});
