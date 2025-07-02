import { describe, expect, it, vi } from 'vitest';
import { BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest } from './endpoints';
import { MetorialSDKError } from './error';

describe('BaseMetorialEndpoint', () => {
  const mockConfig: any = {
    apiKey: 'metorial_pk_dev_testkey',
    clientSecret: 'testsecret',
    apiVersion: '2025-01-01'
  };

  class TestEndpoint extends BaseMetorialEndpoint<any> {
    public get(request: MetorialRequest) {
      return this._get(request);
    }

    public post(request: MetorialRequest) {
      return this._post(request);
    }

    public put(request: MetorialRequest) {
      return this._put(request);
    }

    public delete(request: MetorialRequest) {
      return this._delete(request);
    }
  }

  const endpoint = new TestEndpoint(
    new MetorialEndpointManager(mockConfig, 'http://test', () => ({}), fetch, {
      enableDebugLogging: true
    })
  );

  it('should make a GET request and return transformed data', async () => {
    const mockResponse = { data: 'test' };
    let fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    }) as any;

    const endpoint = new TestEndpoint(
      new MetorialEndpointManager(mockConfig, 'http://test', () => ({}), fetch, {
        enableDebugLogging: true
      })
    );

    const request: MetorialRequest = { path: '/test' };
    const result = await endpoint
      .get(request)
      .transform({ transformFrom: (data: any) => data });

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should make a POST request and return transformed data', async () => {
    const mockResponse = { data: 'test' };
    let fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    }) as any;

    const endpoint = new TestEndpoint(
      new MetorialEndpointManager(mockConfig, 'http://test', () => ({}), fetch, {
        enableDebugLogging: true
      })
    );

    const request: MetorialRequest = { path: '/test', body: { key: 'value' } };
    const result = await endpoint
      .post(request)
      .transform({ transformFrom: (data: any) => data });

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should handle network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    const request: MetorialRequest = { path: '/test' };

    await expect(
      endpoint.get(request).transform({ transformFrom: (data: any) => data })
    ).rejects.toThrow(MetorialSDKError);
  });

  it('should handle malformed JSON responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('Malformed JSON');
      }
    }) as any;

    const request: MetorialRequest = { path: '/test' };

    await expect(
      endpoint.get(request).transform({ transformFrom: (data: any) => data })
    ).rejects.toThrow(MetorialSDKError);
  });

  it('should handle non-OK responses', async () => {
    const mockErrorResponse = { status: 400, code: 'bad_request', message: 'Bad request' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => mockErrorResponse
    }) as any;

    const request: MetorialRequest = { path: '/test' };

    await expect(
      endpoint.get(request).transform({ transformFrom: (data: any) => data })
    ).rejects.toThrow(MetorialSDKError);
  });
});
