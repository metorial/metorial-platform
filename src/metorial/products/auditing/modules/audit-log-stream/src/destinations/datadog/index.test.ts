import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogDestinationEvent } from '../destination';
import { datadogDestination } from '.';

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

describe('Datadog audit log destination', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delivers a structured batch to the Datadog Logs intake API', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    await datadogDestination.deliver({
      providerData: {
        apiKey: 'dd-secret',
        site: 'datadoghq.eu'
      },
      events: [auditLog]
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://http-intake.logs.datadoghq.eu/api/v2/logs',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': 'dd-secret'
        }
      })
    );

    let body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual([
      {
        message: 'organization.update',
        service: 'metorial',
        ddsource: 'metorial-audit-log',
        status: 'info',
        timestamp: '2026-08-13T10:00:00.000Z',
        audit_log: {
          ...auditLog,
          recordedAt: '2026-08-13T10:00:00.000Z'
        }
      }
    ]);
  });

  it('does not make a request for an empty batch', async () => {
    await datadogDestination.deliver({
      providerData: {
        apiKey: 'dd-secret',
        site: 'datadoghq.com'
      },
      events: []
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports HTTP failures without exposing the API key', async () => {
    fetchMock.mockResolvedValue(
      new Response('Invalid API key dd-secret', {
        status: 403,
        statusText: 'Forbidden'
      })
    );

    let error: Error;
    try {
      await datadogDestination.deliver({
        providerData: {
          apiKey: 'dd-secret',
          site: 'datadoghq.com'
        },
        events: [auditLog]
      });
      throw new Error('Expected Datadog delivery to fail');
    } catch (caught) {
      error = caught as Error;
    }

    expect(error.message).toBe('Datadog audit log delivery failed with HTTP 403 Forbidden');
    expect(error.message).not.toContain('dd-secret');
    expect((error as any).details).toEqual({
      code: 'http_error',
      httpStatusCode: 403,
      httpStatusText: 'Forbidden',
      providerErrorCode: null,
      responseBody: 'Invalid API key [REDACTED]'
    });
  });
});
