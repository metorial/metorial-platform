import { uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { markdownService } from '../src';

describe('module-markdown', () => {
  it('renders sanitized GFM markdown to html', async () => {
    let html = await markdownService.renderMarkdown({
      id: uniqueId('md'),
      markdown: [
        '# Hello',
        '',
        '| a | b |',
        '| - | - |',
        '| 1 | 2 |',
        '',
        '<script>alert(1)</script>',
        '',
        '[external](https://example.com)'
      ].join('\n')
    });

    expect(html).toContain('<h1');
    expect(html).toContain('Hello');
    expect(html).toContain('<table');
    expect(html).not.toContain('<script');
    expect(html).toMatch(/<a[^>]+href="https:\/\/example\.com\/"[^>]+target="_blank"/);
  });

  it('prefixes relative links and serves cached renders by id', async () => {
    let id = uniqueId('md');

    let first = await markdownService.renderMarkdown({
      id,
      markdown: '[docs](guide/intro)',
      linkRoot: 'https://metorial.com',
      rootPath: '/docs'
    });
    expect(first).toContain('href="https://metorial.com/docs/guide/intro"');

    let cached = await markdownService.renderMarkdown({
      id,
      markdown: '# Something else',
      linkRoot: 'https://metorial.com',
      rootPath: '/docs'
    });
    expect(cached).toBe(first);
  });
});
