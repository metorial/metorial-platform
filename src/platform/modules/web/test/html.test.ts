import { describe, expect, it } from 'vitest';
import { cleanText, parseManifestIcons, parseWebPage, resolveUrl } from '../src/lib/html';

let pageUrl = 'https://example.com/docs/';

describe('parseWebPage', () => {
  it('extracts attributes', () => {
    let page = parseWebPage(
      `<!doctype html><html lang="en"><head>
        <title>Fallback title</title>
        <meta property="og:title" content="  Example   Docs ">
        <meta name="description" content="A description">
        <meta property="og:site_name" content="Example">
        <meta name="theme-color" content="#ff00aa">
        <link rel="canonical" href="/docs/home">
      </head><body></body></html>`,
      pageUrl
    );

    expect(page).toMatchObject({
      title: 'Example Docs',
      description: 'A description',
      siteName: 'Example',
      lang: 'en',
      themeColor: '#ff00aa',
      canonicalUrl: 'https://example.com/docs/home'
    });
  });

  it('collects icon candidates with sizes and sources', () => {
    let page = parseWebPage(
      `<html><head>
        <link rel="icon" href="/favicon.ico" sizes="16x16 32x32">
        <link rel="shortcut icon" type="image/svg+xml" href="/icon.svg">
        <link rel="apple-touch-icon" href="apple.png" sizes="180x180">
        <link rel="mask-icon" href="/mask.svg">
        <link rel="manifest" href="/site.webmanifest">
        <meta property="og:image" content="/og.png">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta name="twitter:image" content="https://cdn.example.com/tw.png">
        <script type="application/ld+json">
          {"@graph":[{"@type":"Organization","logo":{"@type":"ImageObject","url":"/logo.png"}}]}
        </script>
      </head></html>`,
      pageUrl
    );

    expect(page.manifestUrl).toBe('https://example.com/site.webmanifest');
    expect(page.candidates.map(c => [c.source, c.url, c.declaredWidth])).toEqual([
      ['icon', 'https://example.com/favicon.ico', 32],
      ['svg_icon', 'https://example.com/icon.svg', null],
      ['apple_touch_icon', 'https://example.com/docs/apple.png', 180],
      ['mask_icon', 'https://example.com/mask.svg', null],
      ['jsonld_logo', 'https://example.com/logo.png', null],
      ['og_image', 'https://example.com/og.png', 1200],
      ['twitter_image', 'https://cdn.example.com/tw.png', null]
    ]);
  });

  it('rejects hostile icon urls', () => {
    let page = parseWebPage(
      `<html><head>
        <link rel="icon" href="javascript:alert(1)">
        <link rel="icon" href="data:image/png;base64,AAAA">
        <link rel="icon" href="http://insecure.example.com/a.png">
        <link rel="icon" href="https://user:pass@example.com/a.png">
        <link rel="icon" href="${'/a'.repeat(2000)}.png">
        <link rel="icon" href="/ok.png">
      </head></html>`,
      pageUrl
    );

    expect(page.candidates.map(c => c.url)).toEqual(['https://example.com/ok.png']);
  });

  it('ignores base tags and never executes scripts', () => {
    let page = parseWebPage(
      `<html><head>
        <base href="https://evil.example.net/">
        <script>globalThis.__executed = true</script>
        <link rel="icon" href="/icon.png">
      </head></html>`,
      pageUrl
    );

    expect((globalThis as any).__executed).toBeUndefined();
    expect(page.candidates[0]?.url).toBe('https://example.com/icon.png');
  });

  it('survives deeply nested and malformed html in linear time', () => {
    let nested = '<div><a href=x>'.repeat(50_000);
    let startedAt = Date.now();

    let page = parseWebPage(
      `<html><head><title>Ok</title>${nested}<link rel="icon" href="/late.png">`,
      pageUrl
    );

    expect(page.title).toBe('Ok');
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it('stops at the body and ignores entity floods', () => {
    let page = parseWebPage(
      `<html><head><title>${'&amp;'.repeat(100_000)}</title></head><body><link rel="icon" href="/body.png"></body></html>`,
      pageUrl
    );

    expect(page.title?.length).toBeLessThanOrEqual(200);
    expect(page.candidates).toEqual([]);
  });

  it('survives malformed json-ld and sanitizes text', () => {
    let page = parseWebPage(
      `<html><head>
        <script type="application/ld+json">{not json</script>
        <title>Bad\u202E\u0000 title\n\n</title>
        <meta name="theme-color" content="url(javascript:alert(1))">
      </head></html>`,
      pageUrl
    );

    expect(page.title).toBe('Bad title');
    expect(page.themeColor).toBeNull();
    expect(page.candidates).toEqual([]);
  });
});

describe('parseManifestIcons', () => {
  it('resolves icons against the manifest url', () => {
    let icons = parseManifestIcons(
      JSON.stringify({
        icons: [
          { src: 'icons/192.png', sizes: '192x192' },
          { src: 'javascript:alert(1)' },
          { src: '/512.png', sizes: '512x512' }
        ]
      }),
      'https://example.com/static/site.webmanifest'
    );

    expect(icons.map(i => [i.url, i.declaredWidth])).toEqual([
      ['https://example.com/static/icons/192.png', 192],
      ['https://example.com/512.png', 512]
    ]);
  });

  it('returns nothing for invalid manifests', () => {
    expect(parseManifestIcons('nope', 'https://example.com/m')).toEqual([]);
    expect(parseManifestIcons('{"icons":"x"}', 'https://example.com/m')).toEqual([]);
  });
});

describe('helpers', () => {
  it('caps text length and drops empty text', () => {
    expect(cleanText('a'.repeat(500), 10)).toHaveLength(10);
    expect(cleanText('   \n ', 10)).toBeNull();
    expect(cleanText(42, 10)).toBeNull();
  });

  it('strips fragments from urls', () => {
    expect(resolveUrl('/a.png#x', pageUrl, { httpsOnly: true })).toBe(
      'https://example.com/a.png'
    );
  });
});
