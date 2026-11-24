import { isServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import { maxFilterValueLength, maxFilterValues } from '../src/lib/filterValues';
import {
  assertViewParams,
  maxViewNameLength,
  parseViewName,
  teamViewParamsValidator,
  viewNameKey
} from '../src/lib/views';

let errorOf = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (!isServiceError(error)) throw error;
    return error.data;
  }

  throw new Error('expected a service error');
};

let validate = (params: unknown) => teamViewParamsValidator.validate(params);

describe('saved view names', () => {
  it('trims the name, collapses inner whitespace and keys it without case', () => {
    expect(parseViewName('  High   Effort  ')).toEqual({
      name: 'High Effort',
      nameKey: 'high effort'
    });
    expect(parseViewName('High 　Effort').name).toBe('High Effort');
    expect(parseViewName('ÉQUIPE').nameKey).toBe(parseViewName('équipe').nameKey);
  });

  it('keys composed, decomposed and compatibility forms alike', () => {
    expect(viewNameKey('Café')).toBe(viewNameKey('Café'));
    expect(viewNameKey('ﬁle')).toBe(viewNameKey('FILE'));
    expect(viewNameKey('ＴＥＡＭ')).toBe(viewNameKey('team'));
  });

  it('folds case beyond lower-casing', () => {
    expect(viewNameKey('Straße')).toBe(viewNameKey('STRASSE'));
    expect(viewNameKey('ΟΔΟΣ')).toBe(viewNameKey('οδος'));
  });

  it('refuses empty, blank and long names', () => {
    for (let name of ['', '   ', 'x'.repeat(maxViewNameLength + 1)]) {
      let error = errorOf(() => parseViewName(name));
      expect(error).toMatchObject({ status: 400, code: 'invalid_data' });
      expect(error.errors[0]).toMatchObject({ code: 'invalid_length', path: ['name'] });
    }

    expect(parseViewName('x'.repeat(maxViewNameLength)).name).toHaveLength(maxViewNameLength);
  });

  it('measures the length after trimming and collapsing', () => {
    let padded = `   ${'x'.repeat(40)}      ${'y'.repeat(39)}   `;
    expect(parseViewName(padded).name).toHaveLength(maxViewNameLength);
  });

  it('refuses control, formatting, zero-width and separator characters', () => {
    for (let name of [
      'Tab\there',
      'Line\nbreak',
      'Zero​width',
      'Joiner‍here',
      'Bidi‮override',
      'Byte﻿order',
      'Line separator',
      'Paragraph separator',
      '​'
    ]) {
      let error = errorOf(() => parseViewName(name));
      expect(error.errors[0], JSON.stringify(name)).toMatchObject({
        code: 'invalid_string',
        path: ['name']
      });
    }
  });
});

describe('saved view params', () => {
  it('needs version 1', () => {
    for (let params of [{}, { version: 2 }, { version: 'two' }]) {
      expect(validate(params).success).toBe(false);
    }
  });

  it('drops member ids, dates and other unknown keys', () => {
    let result = validate({
      version: 1,
      member_id: 'aten_1',
      from: '2026-01-01',
      include: 'x'
    });

    expect(result.success && JSON.parse(JSON.stringify(result.value))).toEqual({ version: 1 });
  });

  it('refuses values outside their bounds and accepts their edges', () => {
    for (let params of [
      { range: 'last_90_days' },
      { sort: 'name' },
      { model_share_min: 1.1 },
      { model_ids: [''] },
      { seat_usage_max_micros: 1.5 },
      { model_ids: Array.from({ length: maxFilterValues + 1 }, (_, i) => `m${i}`) },
      { seats: ['x'.repeat(maxFilterValueLength + 1)] }
    ]) {
      expect(validate({ version: 1, ...params }).success, JSON.stringify(params)).toBe(false);
    }

    expect(
      validate({
        version: 1,
        model_ids: Array.from({ length: maxFilterValues }, (_, i) => `m${i}`),
        seats: ['x'.repeat(maxFilterValueLength)],
        model_share_min: 0,
        cache_hit_rate_max: 1,
        seat_usage_max_micros: 0
      }).success
    ).toBe(true);
  });

  it('requires models for a by_model view only', () => {
    for (let model_ids of [undefined, []]) {
      let error = errorOf(() => assertViewParams('by_model', { model_ids }));
      expect(error).toMatchObject({ status: 400, code: 'invalid_data' });
      expect(error.errors[0]).toMatchObject({
        code: 'required',
        path: ['params', 'model_ids']
      });
    }

    expect(() => assertViewParams('by_model', { model_ids: ['a'] })).not.toThrow();
    expect(() => assertViewParams('recent', {})).not.toThrow();
  });
});
