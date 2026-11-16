import { describe, expect, it } from 'vitest';
import { apiUrl, errorCode, ingest, ingestUrl } from './support';

describe('agent-tracking endpoints', () => {
  it('answers the health check on both listeners', async () => {
    for (let url of [apiUrl(), ingestUrl()]) {
      let response = await fetch(`${url}/ping`);

      expect(response.status).toBe(200);
    }
  });

  it('keeps the dialect list public', async () => {
    let response = await ingest('/v1/bulk/dialects', { method: 'GET' });

    expect(response.status).toBe(200);
  });

  it('answers unknown ingest routes with 404', async () => {
    let response = await ingest('/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe('route_not_found');
  });

  it('answers a wrong method with 405 and an Allow header', async () => {
    let response = await ingest('/ping', { method: 'POST' });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toContain('GET');
    expect(await errorCode(response)).toBe('method_not_allowed');
  });
});
