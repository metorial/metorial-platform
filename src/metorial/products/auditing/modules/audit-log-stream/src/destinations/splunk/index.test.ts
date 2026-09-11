import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogDestinationEvent } from '../destination';
import { splunkDestination } from '.';

vi.mock('@lowerdeck/ssrf', () => ({
  safeFetch: (input: string, init?: RequestInit) => fetch(input, init)
}));

let auditLog = {
  id: 'aud_1',
  eventId: 'evt_1',
  resource: 'organization',
  action: 'update',
  organizationId: 'org_1',
  instanceId: undefined,
  organizationActorId: undefined,
  actor: undefined,
  context: {
    ip: '127.0.0.1',
    ua: 'vitest'
  },
  payload: { name: 'Acme' },
  previousAttributes: { name: 'Old Acme' },
  recordedAt: new Date('2026-08-13T10:00:00.000Z')
} satisfies AuditLogDestinationEvent;

describe('Splunk audit log destination', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delivers HEC envelopes with configured metadata', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ text: 'Success', code: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await splunkDestination.deliver({
      providerData: {
        endpoint: 'https://splunk.example.com/services/collector',
        token: 'splunk-secret',
        index: 'audit',
        source: 'metorial',
        sourcetype: '_json'
      },
      events: [auditLog, { ...auditLog, id: 'aud_2' }]
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://splunk.example.com/services/collector',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Splunk splunk-secret'
        }
      })
    );

    let body = fetchMock.mock.calls[0]![1].body as string;
    expect(body.split('\n').map(line => JSON.parse(line))).toEqual([
      {
        time: 1786615200,
        event: {
          ...auditLog,
          recordedAt: '2026-08-13T10:00:00.000Z'
        },
        index: 'audit',
        source: 'metorial',
        sourcetype: '_json'
      },
      {
        time: 1786615200,
        event: {
          ...auditLog,
          id: 'aud_2',
          recordedAt: '2026-08-13T10:00:00.000Z'
        },
        index: 'audit',
        source: 'metorial',
        sourcetype: '_json'
      }
    ]);
  });

  it('does not make a request for an empty batch', async () => {
    await splunkDestination.deliver({
      providerData: {
        endpoint: 'https://splunk.example.com/services/collector',
        token: 'splunk-secret'
      },
      events: []
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsuccessful HEC responses', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ text: 'Invalid token', code: 4 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    let promise = splunkDestination.deliver({
      providerData: {
        endpoint: 'https://splunk.example.com/services/collector',
        token: 'splunk-secret'
      },
      events: [auditLog]
    });

    await expect(promise).rejects.toMatchObject({
      message: 'Splunk audit log delivery failed with response code 4',
      details: {
        code: 'provider_error',
        httpStatusCode: 200,
        httpStatusText: null,
        providerErrorCode: '4',
        responseBody: '{"text":"Invalid token","code":4}'
      }
    });
  });

  it('reports HTTP failures without exposing the HEC token', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 503,
        statusText: 'Unavailable'
      })
    );

    let error: Error;
    try {
      await splunkDestination.deliver({
        providerData: {
          endpoint: 'https://splunk.example.com/services/collector',
          token: 'splunk-secret'
        },
        events: [auditLog]
      });
      throw new Error('Expected Splunk delivery to fail');
    } catch (caught) {
      error = caught as Error;
    }

    expect(error.message).toBe('Splunk audit log delivery failed with HTTP 503 Unavailable');
    expect(error.message).not.toContain('splunk-secret');
    expect((error as any).details).toEqual({
      code: 'http_error',
      httpStatusCode: 503,
      httpStatusText: 'Unavailable',
      providerErrorCode: null,
      responseBody: null
    });
  });
});
