import { describe, expect, it } from 'vitest';
import { isDocumentId } from './documentId';

describe('isDocumentId', () => {
  it('accepts generated document ids', () => {
    expect(isDocumentId('doc_0mhz3k2p1Ab9XyZ01234cd')).toBe(true);
    expect(isDocumentId(`doc_${'a'.repeat(10)}`)).toBe(true);
    expect(isDocumentId(`doc_${'Z'.repeat(64)}`)).toBe(true);
  });

  it('rejects ids with another prefix or no prefix', () => {
    expect(isDocumentId('fil_0mhz3k2p1Ab9XyZ01234cd')).toBe(false);
    expect(isDocumentId('0mhz3k2p1Ab9XyZ01234cd')).toBe(false);
    expect(isDocumentId('xdoc_0mhz3k2p1Ab9XyZ01234cd')).toBe(false);
  });

  it('rejects ids with path, separator or whitespace characters', () => {
    for (let id of [
      'doc_x/../../../../buckets/other/objects/key',
      'doc_0mhz3k2p1Ab9/XyZ01234cd',
      'doc_0mhz3k2p1Ab9..XyZ01234',
      'doc_0mhz3k2p1Ab9%2fXyZ0123',
      'doc_0mhz3k2p1Ab9\\XyZ01234',
      'doc_0mhz3k2p1Ab9?XyZ012345',
      'doc_0mhz3k2p1Ab9#XyZ012345',
      'doc_0mhz3k2p1Ab9_XyZ012345',
      'doc_0mhz3k2p1Ab9-XyZ012345',
      'doc_0mhz3k2p1Ab9 XyZ012345',
      'doc_0mhz3k2p1Ab9XyZ01234cd\n',
      '\ndoc_0mhz3k2p1Ab9XyZ01234cd'
    ]) {
      expect(isDocumentId(id), id).toBe(false);
    }
  });

  it('rejects ids that are too short or too long', () => {
    expect(isDocumentId('doc_')).toBe(false);
    expect(isDocumentId(`doc_${'a'.repeat(9)}`)).toBe(false);
    expect(isDocumentId(`doc_${'a'.repeat(65)}`)).toBe(false);
  });
});
