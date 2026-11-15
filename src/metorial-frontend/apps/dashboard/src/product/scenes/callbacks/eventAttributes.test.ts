import { describe, expect, it } from 'vitest';
import {
  eventAttributeKeys,
  eventAttributeLabel,
  eventAttributeOptions,
  formatEventAttributes
} from './eventAttributes';

let trigger = (properties: Record<string, any>) => ({
  outputSchema: { schema: { type: 'object', properties } }
});

describe('eventAttributeKeys', () => {
  it('collects the marked output fields of all triggers once, sorted', () => {
    expect(
      eventAttributeKeys([
        trigger({
          mimeType: { type: 'string', 'x-slates-event-attribute': true },
          name: { type: 'string' },
          fileId: { type: 'string', 'x-slates-event-attribute': true }
        }),
        trigger({ fileId: { type: 'string', 'x-slates-event-attribute': true } }),
        trigger({ threadId: { type: 'string', 'x-slates-event-attribute': 'yes' } }),
        { outputSchema: null },
        {}
      ])
    ).toEqual(['fileId', 'mimeType']);
  });
});

describe('eventAttributeOptions', () => {
  let keys = ['fileId', 'mimeType'];

  it('offers the typed value for every field', () => {
    expect(eventAttributeOptions(keys, ' abc ')).toEqual([
      { id: 'fileId:abc', label: 'fileId is abc' },
      { id: 'mimeType:abc', label: 'mimeType is abc' }
    ]);
  });

  it('takes a typed field name as the field to filter', () => {
    expect(eventAttributeOptions(keys, 'mimeType:text/plain')).toEqual([
      { id: 'mimeType:text/plain', label: 'mimeType is text/plain' }
    ]);
    expect(eventAttributeOptions(keys, 'mimeType:')).toEqual([]);
  });

  it('keeps a colon in a value that names no field', () => {
    expect(eventAttributeOptions(['fileId'], 'urn:file:1')).toEqual([
      { id: 'fileId:urn:file:1', label: 'fileId is urn:file:1' }
    ]);
  });

  it('offers nothing without text or without fields', () => {
    expect(eventAttributeOptions(keys, '  ')).toEqual([]);
    expect(eventAttributeOptions([], 'abc')).toEqual([]);
  });
});

describe('eventAttributeLabel', () => {
  it('splits at the first colon', () => {
    expect(eventAttributeLabel('fileId:a:b')).toBe('fileId is a:b');
    expect(eventAttributeLabel('no-separator')).toBe('no-separator');
  });
});

describe('formatEventAttributes', () => {
  it('lists every value with its field', () => {
    expect(formatEventAttributes({ fileId: ['a'], parents: ['p1', 'p2'] })).toEqual([
      'fileId: a',
      'parents: p1',
      'parents: p2'
    ]);
    expect(formatEventAttributes(null)).toEqual([]);
  });
});
