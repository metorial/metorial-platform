import { describe, expect, it } from 'vitest';
import {
  getDirectUploadFileType,
  getDocumentContentType,
  getServedContentType,
  isPassiveMediaType,
  parseMediaType,
  serializeMediaType
} from './mediaType';

let multiValuedTypes = [
  'image/png, text/html',
  'image/png,text/html',
  'text/html, image/png',
  'image/png text/html',
  'image/png\r\ncontent-type: text/html',
  'image/png\ttext/html',
  'image/png/html',
  'image/',
  '/png',
  'image',
  'ima ge/png',
  '<script>/png',
  '',
  '   '
];

describe('parseMediaType', () => {
  it('parses a single type and subtype', () => {
    expect(parseMediaType('image/png')).toEqual({ type: 'image', essence: 'image/png' });
    expect(parseMediaType('  Image/PNG  ')).toMatchObject({ essence: 'image/png' });
    expect(parseMediaType('application/vnd.ms-excel')).toMatchObject({
      type: 'application',
      essence: 'application/vnd.ms-excel'
    });
    expect(parseMediaType('image/svg+xml')).toMatchObject({ essence: 'image/svg+xml' });
  });

  it('keeps a well formed charset and drops every other parameter', () => {
    expect(parseMediaType('text/plain; charset=UTF-8')).toMatchObject({ charset: 'utf-8' });
    expect(parseMediaType('text/plain;charset="utf-8"')).toMatchObject({ charset: 'utf-8' });
    expect(parseMediaType('text/plain; charset=utf-8, text/html')?.charset).toBeUndefined();
    expect(parseMediaType('video/webm;codecs=vp8,opus')).toEqual({
      type: 'video',
      essence: 'video/webm',
      charset: undefined
    });
    expect(
      serializeMediaType(parseMediaType('image/png; boundary=x, text/html; charset=utf-8')!)
    ).toBe('image/png; charset=utf-8');
  });

  it.each(multiValuedTypes)('rejects %j', value => {
    expect(parseMediaType(value)).toBeNull();
  });

  it('rejects missing values', () => {
    expect(parseMediaType(null)).toBeNull();
    expect(parseMediaType(undefined)).toBeNull();
  });
});

describe('getServedContentType', () => {
  it('serves images under their own type', () => {
    expect(getServedContentType('image/png')).toBe('image/png');
    expect(getServedContentType('IMAGE/JPEG')).toBe('image/jpeg');
    expect(getServedContentType('image/svg+xml; charset=utf-8')).toBe(
      'image/svg+xml; charset=utf-8'
    );
  });

  it('serves everything else as a download type', () => {
    for (let value of ['text/html', 'application/pdf', 'video/mp4', null, undefined]) {
      expect(getServedContentType(value), String(value)).toBe('application/octet-stream');
    }
  });

  it.each(multiValuedTypes)('serves the stored value %j as a download type', value => {
    expect(getServedContentType(value)).toBe('application/octet-stream');
  });

  it('never echoes extra values or parameters of a stored type', () => {
    expect(getServedContentType('image/png; a=b, text/html')).toBe('image/png');
    expect(getServedContentType('image/png;, text/html')).toBe('image/png');
  });
});

describe('getDocumentContentType', () => {
  it('keeps a clean document type', () => {
    expect(getDocumentContentType('text/markdown')).toBe('text/markdown');
    expect(getDocumentContentType('text/html;charset=UTF-8')).toBe('text/html; charset=utf-8');
  });

  it('falls back to plain text for missing and generic types', () => {
    expect(getDocumentContentType(null)).toBe('text/plain; charset=utf-8');
    expect(getDocumentContentType('')).toBe('text/plain; charset=utf-8');
    expect(getDocumentContentType('application/octet-stream')).toBe(
      'text/plain; charset=utf-8'
    );
  });

  it('serves a stored value that is not a single type as a download type', () => {
    expect(getDocumentContentType('image/png, text/html')).toBe('application/octet-stream');
    expect(getDocumentContentType('video/mp4, text/html')).toBe('application/octet-stream');
  });
});

describe('isPassiveMediaType', () => {
  it.each([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/avif',
    'application/pdf',
    'video/mp4',
    'audio/mpeg',
    'IMAGE/PNG',
    'image/png; charset=utf-8'
  ])('treats %s as passive', value => {
    expect(isPassiveMediaType(value)).toBe(true);
  });

  it.each([
    'image/svg+xml',
    'text/html',
    'text/plain; charset=utf-8',
    'application/xhtml+xml',
    'application/xml',
    'application/octet-stream',
    'image/x-unknown',
    'image/png, text/html',
    'video/mp4, text/html',
    'application/pdf, text/html',
    ''
  ])('sandboxes %j', value => {
    expect(isPassiveMediaType(value)).toBe(false);
  });

  it('sandboxes every stored value that is not a single type once it is served', () => {
    for (let value of multiValuedTypes) {
      expect(isPassiveMediaType(getServedContentType(value)), value).toBe(false);
      expect(isPassiveMediaType(getDocumentContentType(value)), value).toBe(false);
    }
  });
});

describe('getDirectUploadFileType', () => {
  it('keeps the types clients ordinarily send', () => {
    for (let value of [
      'image/png',
      'application/pdf',
      'text/plain;charset=utf-8',
      'text/csv; charset=utf-8',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream'
    ]) {
      expect(getDirectUploadFileType(value), value).toBe(value);
    }
  });

  it('leaves a missing type to the default', () => {
    expect(getDirectUploadFileType('')).toBeUndefined();
    expect(getDirectUploadFileType(undefined)).toBeUndefined();
  });

  it('reduces a type with list-valued parameters to the type itself', () => {
    expect(getDirectUploadFileType('video/webm;codecs=vp8,opus')).toBe('video/webm');
    expect(getDirectUploadFileType('image/png; a=b, text/html')).toBe('image/png');
  });

  it('stores a value that is not a single type as a generic binary', () => {
    expect(getDirectUploadFileType('image/png, text/html')).toBe('application/octet-stream');
    expect(getDirectUploadFileType('not a type')).toBe('application/octet-stream');
  });
});
