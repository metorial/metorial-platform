import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let { getDirectory, handle, begin, complete, record } = vi.hoisted(() => ({
  getDirectory: vi.fn(),
  handle: vi.fn(),
  begin: vi.fn(),
  complete: vi.fn(),
  record: vi.fn()
}));

vi.mock('@mtsrc/auth-core-module-sso', () => ({
  jackson: { directorySyncController: { requests: { handle } } },
  ssoDirectoryService: { getDirectoryByInternalId: getDirectory },
  ssoDirectorySyncService: {
    beginScimOperation: begin,
    completeScimOperation: complete,
    recordScimOperation: record
  }
}));

import { scimApp } from './scim';

let directory = { oid: 1n, scimSecret: 'test-secret' };

let request = (authorization?: string, contentLength?: string) =>
  new Request('https://metorial.example.test/directory/Users?filter=example&count=5', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/scim+json',
      ...(authorization ? { Authorization: authorization } : {}),
      ...(contentLength ? { 'Content-Length': contentLength } : {})
    },
    body: JSON.stringify({
      Operations: [{ op: 'replace', path: 'password', value: 'private' }]
    })
  });

describe('SCIM request handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getDirectory.mockResolvedValue(directory);
    begin.mockResolvedValue({ id: 'operation' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([undefined, 'Bearer different-secret', 'Basic test-secret'])(
    'rejects invalid credentials without reading the body or creating logs',
    async authorization => {
      let req = request(authorization);
      let response = await scimApp.request(req);

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
      expect(req.bodyUsed).toBe(false);
      expect(handle).not.toHaveBeenCalled();
      expect(begin).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    }
  );

  it('returns the same challenge for an unavailable directory', async () => {
    getDirectory.mockResolvedValueOnce(null);

    let response = await scimApp.request(request('Bearer test-secret'));

    expect(response.status).toBe(401);
    expect(begin).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies after authentication', async () => {
    let response = await scimApp.request(request('Bearer test-secret', '5242881'));

    expect(response.status).toBe(413);
    expect(begin).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });

  it('uses the original payload for provisioning and redacts the audit copy', async () => {
    handle.mockResolvedValueOnce({
      status: 200,
      data: { userName: 'person', token: 'private' }
    });

    let response = await scimApp.request(request('Bearer test-secret'));

    expect(response.status).toBe(200);
    expect(handle.mock.calls[0]?.[0].body.Operations[0].value).toBe('private');
    expect(begin.mock.calls[0]?.[0].input).toMatchObject({
      query: { filter: '[Redacted]', count: 5 },
      requestBody: { Operations: [{ op: 'replace', path: 'password', value: '[Redacted]' }] }
    });
    expect(complete.mock.calls[0]?.[0].input.responseBody).toEqual({
      userName: 'person',
      token: '[Redacted]'
    });
  });

  it.each([409, 500])('sanitizes SCIM failures with status %d', async status => {
    let details = 'Private database diagnostic';
    if (status === 409) {
      handle.mockResolvedValueOnce({ status, data: { detail: details } });
    } else {
      handle.mockRejectedValueOnce(new Error(details));
    }

    let response = await scimApp.request(request('Bearer test-secret'));

    expect(response.status).toBe(status);
    expect(response.headers.get('Content-Type')).toBe('application/scim+json');
    expect(await response.text()).not.toContain(details);
    expect(JSON.stringify(complete.mock.calls[0]?.[0].input)).not.toContain(details);
  });
});
