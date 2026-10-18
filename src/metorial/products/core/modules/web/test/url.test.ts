import { describe, expect, it } from 'vitest';
import { buildPageChain, normalizeWebUrl } from '../src/lib/url';

describe('normalizeWebUrl', () => {
  it('drops query, fragment, credentials, port and trailing slashes', () => {
    let normalized = normalizeWebUrl(
      'https://user:pass@Docs.MCP.Cloudflare.com:8443/mcp/?key=secret#frag'
    );

    expect(normalized).toMatchObject({
      urlKey: 'docs.mcp.cloudflare.com/mcp',
      pageUrl: 'https://docs.mcp.cloudflare.com/mcp',
      host: 'docs.mcp.cloudflare.com',
      pathname: '/mcp',
      registrableDomain: 'cloudflare.com'
    });
  });

  it('treats http and https as the same key', () => {
    expect(normalizeWebUrl('http://example.com/')?.urlKey).toBe(
      normalizeWebUrl('https://example.com')?.urlKey
    );
  });

  it('rejects unsupported protocols and invalid input', () => {
    expect(normalizeWebUrl('ftp://example.com')).toBeNull();
    expect(normalizeWebUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeWebUrl('not a url')).toBeNull();
    expect(normalizeWebUrl(`https://example.com/${'a'.repeat(3000)}`)).toBeNull();
  });

  it('has no registrable domain for IPs and public suffixes', () => {
    expect(normalizeWebUrl('https://10.0.0.1/mcp')?.registrableDomain).toBeNull();
    expect(normalizeWebUrl('https://github.io/')?.registrableDomain).toBeNull();
  });
});

describe('buildPageChain', () => {
  let chain = (url: string) => buildPageChain(normalizeWebUrl(url)!);

  it('walks from the exact url up to the registrable domain', () => {
    expect(chain('https://docs.mcp.cloudflare.com/mcp')).toEqual([
      'https://docs.mcp.cloudflare.com/mcp',
      'https://docs.mcp.cloudflare.com/',
      'https://mcp.cloudflare.com/',
      'https://cloudflare.com/'
    ]);
  });

  it('does not repeat the root page when there is no path', () => {
    expect(chain('https://mcp.example.com')).toEqual([
      'https://mcp.example.com/',
      'https://example.com/'
    ]);
  });

  it('never goes above the registrable domain', () => {
    expect(chain('https://foo.bar.co.uk/x')).toEqual([
      'https://foo.bar.co.uk/x',
      'https://foo.bar.co.uk/',
      'https://bar.co.uk/'
    ]);

    expect(chain('https://foo.github.io/')).toEqual(['https://foo.github.io/']);
  });

  it('only fetches the host for ip addresses', () => {
    expect(chain('https://203.0.113.5/mcp')).toEqual([
      'https://203.0.113.5/mcp',
      'https://203.0.113.5/'
    ]);
  });

  it('keeps the registrable domain when the chain is capped', () => {
    let pages = chain('https://a.b.c.d.e.f.example.com/x');

    expect(pages).toHaveLength(5);
    expect(pages[pages.length - 1]).toBe('https://example.com/');
  });
});
