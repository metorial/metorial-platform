import { eventually, uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { normalizeWebUrl, webDiscoveryService } from '../src';

describe('module-web', () => {
  it('normalizes urls and rejects invalid ones', async () => {
    let normalized = normalizeWebUrl('http://Docs.Example.com/guide/');
    expect(normalized).toMatchObject({
      urlKey: 'docs.example.com/guide',
      pageUrl: 'https://docs.example.com/guide',
      host: 'docs.example.com',
      registrableDomain: 'example.com'
    });
    expect(normalizeWebUrl('ftp://example.com')).toBeNull();

    await expect(webDiscoveryService.discover({ url: 'not a url' })).rejects.toThrow(
      /Invalid URL/
    );
  });

  it('deduplicates discoveries by url and fails unreachable private hosts', async () => {
    let url = `https://127.0.0.1/${uniqueId('page')}`;

    let discovery = await webDiscoveryService.discover({ url });
    expect(discovery.status).toBe('pending');

    let again = await webDiscoveryService.discover({ url: `${url}/` });
    expect(again.id).toBe(discovery.id);

    let byUrl = await webDiscoveryService.getWebDiscoveryByUrl({ url });
    expect(byUrl?.id).toBe(discovery.id);

    let settled = await eventually(
      async () => {
        let current = await webDiscoveryService.getWebDiscoveryById({
          webDiscoveryId: discovery.id
        });
        expect(webDiscoveryService.isTerminal(current)).toBe(true);
        return current;
      },
      { timeoutMs: 45_000, intervalMs: 500 }
    );
    expect(settled.status).toBe('failed');
    expect(settled.errorCode).toBe('no_page_reachable');
  });
});
