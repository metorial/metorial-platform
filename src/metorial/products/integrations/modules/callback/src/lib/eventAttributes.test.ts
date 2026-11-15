import { describe, expect, it } from 'vitest';
import {
  eventAttributesValidator,
  flattenEventAttributes,
  parseEventAttributeFilter,
  unflattenEventAttributes
} from './eventAttributes';

let errorsOf = (value: unknown) => {
  let result = eventAttributesValidator.validate(value);
  return result.success ? [] : result.errors;
};

describe('eventAttributesValidator', () => {
  it('accepts attributes within the limits', () => {
    let attributes = {
      fileId: ['1aBc'],
      mimeType: ['application/pdf', 'text/plain'],
      a_1: ['x'.repeat(256)]
    };

    expect(eventAttributesValidator.validate(attributes)).toEqual({
      success: true,
      value: attributes
    });
  });

  it('accepts sixteen values per key and eight keys', () => {
    let attributes = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [
        `key${i}`,
        Array.from({ length: 16 }, (_, j) => `v${j}`)
      ])
    );

    expect(errorsOf(attributes)).toEqual([]);
  });

  it('rejects more than eight keys', () => {
    let attributes = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`key${i}`, ['v']])
    );

    expect(errorsOf(attributes)[0]?.message).toMatch(/at most 8 attributes/);
  });

  it('rejects invalid keys', () => {
    expect(errorsOf({ '1abc': ['v'] })[0]?.message).toMatch(/Invalid attribute key "1abc"/);
    expect(errorsOf({ 'file-id': ['v'] })).not.toEqual([]);
    expect(errorsOf({ 'a:b': ['v'] })).not.toEqual([]);
    expect(errorsOf({ ['a'.repeat(65)]: ['v'] })).not.toEqual([]);
    expect(errorsOf({ ['a'.repeat(64)]: ['v'] })).toEqual([]);
  });

  it('rejects empty, overlong and non-string values', () => {
    expect(errorsOf({ fileId: [] })[0]?.message).toMatch(/at least one value/);
    expect(errorsOf({ fileId: [''] })[0]?.message).toMatch(/must not be empty/);
    expect(errorsOf({ fileId: ['x'.repeat(257)] })[0]?.message).toMatch(/at most 256/);
    expect(errorsOf({ fileId: [1] })).not.toEqual([]);
    expect(errorsOf({ fileId: 'abc' })).not.toEqual([]);
  });

  it('rejects more than sixteen values for a key', () => {
    let values = Array.from({ length: 17 }, (_, i) => `v${i}`);

    expect(errorsOf({ fileId: values })[0]?.message).toMatch(/at most 16 values/);
  });

  it('rejects non-objects', () => {
    expect(errorsOf(['fileId:1'])).not.toEqual([]);
    expect(errorsOf(null)).not.toEqual([]);
  });
});

describe('flattenEventAttributes', () => {
  it('produces one key:value entry per value', () => {
    expect(
      flattenEventAttributes({ fileId: ['f1'], mimeType: ['text/plain', 'image/png'] })
    ).toEqual(['fileId:f1', 'mimeType:text/plain', 'mimeType:image/png']);
  });

  it('keeps colons inside values and drops duplicates', () => {
    expect(flattenEventAttributes({ url: ['https://a.b:8080', 'https://a.b:8080'] })).toEqual([
      'url:https://a.b:8080'
    ]);
  });

  it('returns an empty list when there are no attributes', () => {
    expect(flattenEventAttributes(null)).toEqual([]);
    expect(flattenEventAttributes(undefined)).toEqual([]);
    expect(flattenEventAttributes({})).toEqual([]);
  });
});

describe('unflattenEventAttributes', () => {
  it('groups values by key, splitting at the first colon', () => {
    expect(
      unflattenEventAttributes(['fileId:f1', 'url:https://a.b:8080/x', 'fileId:f2'])
    ).toEqual({ fileId: ['f1', 'f2'], url: ['https://a.b:8080/x'] });
  });

  it('round-trips with flattenEventAttributes', () => {
    let attributes = { fileId: ['f1', 'f2'], range: ['A1:B2'] };

    expect(unflattenEventAttributes(flattenEventAttributes(attributes))).toEqual(attributes);
  });

  it('returns an empty object for no entries', () => {
    expect(unflattenEventAttributes([])).toEqual({});
  });
});

describe('parseEventAttributeFilter', () => {
  it('groups values for the same key', () => {
    expect(
      parseEventAttributeFilter(['mimeType:text/plain', 'fileId:f1', 'mimeType:a/b'])
    ).toEqual({ mimeType: ['text/plain', 'a/b'], fileId: ['f1'] });
  });

  it('splits at the first colon so values may contain colons', () => {
    expect(parseEventAttributeFilter(['range:A1:B2', 'url:https://x.y:1'])).toEqual({
      range: ['A1:B2'],
      url: ['https://x.y:1']
    });
  });

  it('returns an empty filter for no entries', () => {
    expect(parseEventAttributeFilter([])).toEqual({});
  });

  it.each(['fileId', 'fileId:', ':f1', '1abc:f1', 'file-id:f1', `fileId:${'x'.repeat(257)}`])(
    'rejects the malformed entry %j with a bad request',
    entry => {
      let error = (() => {
        try {
          parseEventAttributeFilter(['fileId:ok', entry]);
        } catch (err: any) {
          return err;
        }
      })();

      expect(error?.data).toMatchObject({ status: 400, code: 'bad_request' });
      expect(error?.data.message).toMatch(/Invalid attribute filter/);
    }
  );
});
