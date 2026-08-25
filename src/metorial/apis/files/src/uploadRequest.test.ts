import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-file', () => ({
  purposeSlugs: [
    'user_image',
    'organization_image',
    'project_brand_image',
    'skill_image',
    'skill_export',
    'generic'
  ]
}));

import { parseUploadMode, parseUploadRequest } from './uploadRequest';

let getUploadUrlBody = (overrides?: Record<string, unknown>) => ({
  mode: 'get_upload_url',
  purpose: 'generic',
  file_name: 'video.mp4',
  file_size: 104857600,
  ...overrides
});

describe('upload mode', () => {
  it('defaults to direct when absent', () => {
    expect(parseUploadMode(null)).toBe('direct');
    expect(parseUploadMode(undefined)).toBe('direct');
    expect(parseUploadMode('')).toBe('direct');
  });

  it('accepts the known modes', () => {
    expect(parseUploadMode('direct')).toBe('direct');
    expect(parseUploadMode('get_upload_url')).toBe('get_upload_url');
    expect(parseUploadMode('complete')).toBe('complete');
  });

  it('rejects unknown modes', () => {
    expect(() => parseUploadMode('upload')).toThrow(/mode must be one of/);
  });
});

describe('get_upload_url requests', () => {
  it('parses a minimal request', () => {
    let body = parseUploadRequest(getUploadUrlBody());

    expect(body).toMatchObject({
      mode: 'get_upload_url',
      purpose: 'generic',
      file_name: 'video.mp4',
      file_size: 104857600
    });
  });

  it('parses store attachment fields', () => {
    let body = parseUploadRequest(
      getUploadUrlBody({ store_id: 'sto_1', path: 'a/b.mp4', store_replace: true })
    );

    expect(body).toMatchObject({
      store_id: 'sto_1',
      path: 'a/b.mp4',
      store_replace: true
    });
  });

  it('requires a file size', () => {
    expect(() => parseUploadRequest(getUploadUrlBody({ file_size: undefined }))).toThrow();
  });

  it('rejects non-positive and fractional file sizes', () => {
    expect(() => parseUploadRequest(getUploadUrlBody({ file_size: 0 }))).toThrow();
    expect(() => parseUploadRequest(getUploadUrlBody({ file_size: -1 }))).toThrow();
    expect(() => parseUploadRequest(getUploadUrlBody({ file_size: 1.5 }))).toThrow();
  });

  it('rejects unknown purposes', () => {
    expect(() => parseUploadRequest(getUploadUrlBody({ purpose: 'document' }))).toThrow();
    expect(() => parseUploadRequest(getUploadUrlBody({ purpose: 'nope' }))).toThrow();
  });

  it('requires store_id and path together', () => {
    expect(() => parseUploadRequest(getUploadUrlBody({ store_id: 'sto_1' }))).toThrow(
      /store_id and path must be provided together/
    );
    expect(() => parseUploadRequest(getUploadUrlBody({ path: 'a/b.mp4' }))).toThrow(
      /store_id and path must be provided together/
    );
  });

  it('requires a store for replace mode', () => {
    expect(() => parseUploadRequest(getUploadUrlBody({ store_replace: true }))).toThrow(
      /store_replace requires store_id and path/
    );
  });
});

describe('complete requests', () => {
  it('parses a complete request', () => {
    expect(parseUploadRequest({ mode: 'complete', file_upload_id: 'fup_1' })).toMatchObject({
      mode: 'complete',
      file_upload_id: 'fup_1'
    });
  });

  it('requires the file upload id', () => {
    expect(() => parseUploadRequest({ mode: 'complete' })).toThrow();
  });

  it('ignores get_upload_url fields', () => {
    let body = parseUploadRequest({ mode: 'complete', file_upload_id: 'fup_1', file_size: -5 });

    expect(body).toMatchObject({ mode: 'complete', file_upload_id: 'fup_1' });
  });
});

describe('rejected bodies', () => {
  it('rejects direct uploads sent as JSON', () => {
    expect(() => parseUploadRequest({ mode: 'direct' })).toThrow(
      /must be sent as multipart\/form-data/
    );
    expect(() => parseUploadRequest({})).toThrow(/must be sent as multipart\/form-data/);
  });

  it('rejects non-object bodies', () => {
    expect(() => parseUploadRequest(null)).toThrow(/Expected a JSON object body/);
    expect(() => parseUploadRequest([])).toThrow(/Expected a JSON object body/);
    expect(() => parseUploadRequest('mode=complete')).toThrow(/Expected a JSON object body/);
  });
});
