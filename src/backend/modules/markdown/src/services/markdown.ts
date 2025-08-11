import { createCachedFunction } from '@metorial/cache';
import { Service } from '@metorial/service';
import { Markdown, MarkdownOptions } from '../lib/markdown';

let getMarkdownHtml = createCachedFunction({
  name: 'mrkdw/html',
  ttlSeconds: 60 * 60,
  getHash: (d: { markdown: string } & MarkdownOptions) => d.id,
  provider: (d: { markdown: string } & MarkdownOptions) =>
    Markdown.from(d.markdown, d).toHtml()
});

class MarkdownServiceImpl {
  async renderMarkdown(d: { markdown: string } & MarkdownOptions) {
    return getMarkdownHtml(d);
  }
}

export let markdownService = Service.create(
  'markdown',
  () => new MarkdownServiceImpl()
).build();
