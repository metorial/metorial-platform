import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Markdown } from '../src/lib/markdown';

// Mock external dependencies
vi.mock('@metorial/db/src/lib/getImageUrl', () => ({
  getImageUrl: vi.fn(async ({ image }) => {
    if (image.type === 'url') {
      return `https://proxy.metorial.com/image?url=${encodeURIComponent(image.url)}`;
    }
    return image.url;
  })
}));

vi.mock('@metorial/cache', () => ({
  createCachedFunction: vi.fn(({ provider, getHash }) => {
    // Simple in-memory cache for testing
    const cache = new Map();
    return async (data: any) => {
      const hash = getHash(data);
      if (cache.has(hash)) {
        return cache.get(hash);
      }
      const result = await provider(data);
      cache.set(hash, result);
      return result;
    };
  })
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name: string, factory: () => any) => ({
      build: () => factory()
    }))
  }
}));

// Import the service after mocks are set up
import { markdownService } from '../src/services/markdown';

describe('MarkdownService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renderMarkdown', () => {
    it('should render simple markdown to HTML', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '# Hello World',
        id: 'test-simple'
      });

      expect(result).toContain('<h1>Hello World</h1>');
    });

    it('should render markdown with bold and italic', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '**bold** and *italic*',
        id: 'test-bold-italic'
      });

      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('should render markdown with links', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '[Link](https://example.com)',
        id: 'test-links'
      });

      expect(result).toContain('<a href="https://example.com/"');
      expect(result).toContain('target="_blank"');
    });

    it('should render markdown with images', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '![Image](https://example.com/image.png)',
        id: 'test-images'
      });

      expect(result).toContain('<img');
      expect(result).toContain('alt="Image"');
    });

    it('should handle linkRoot option', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '[Link](./path/to/file)',
        id: 'test-linkroot',
        linkRoot: 'https://github.com/user/repo'
      });

      expect(result).toContain('https://github.com/user/repo/path/to/file');
    });

    it('should handle imageRoot option', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '![Image](./image.png)',
        id: 'test-imageroot',
        imageRoot: 'https://cdn.example.com'
      });

      // External CDN images get proxied
      expect(result).toContain('proxy.metorial.com');
      expect(result).toContain('cdn.example.com');
    });

    it('should handle rootPath option with linkRoot', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '[Link](./file.md)',
        id: 'test-rootpath-link',
        linkRoot: 'https://github.com/user/repo',
        rootPath: 'docs'
      });

      expect(result).toContain('https://github.com/user/repo/docs/file.md');
    });

    it('should handle rootPath option with imageRoot', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '![Image](./image.png)',
        id: 'test-rootpath-image',
        imageRoot: 'https://cdn.example.com',
        rootPath: 'assets'
      });

      // External CDN images get proxied
      expect(result).toContain('proxy.metorial.com');
      expect(result).toContain('assets');
    });

    it('should render GFM tables', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |',
        id: 'test-tables'
      });

      expect(result).toContain('<table>');
      expect(result).toContain('<thead>');
      expect(result).toContain('Header 1');
    });

    it('should render GFM task lists', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '- [ ] Todo\n- [x] Done',
        id: 'test-tasklists'
      });

      expect(result).toContain('task-list-item');
      expect(result).toContain('type="checkbox"');
    });

    it('should render GFM strikethrough', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '~~strikethrough~~',
        id: 'test-strikethrough'
      });

      expect(result).toContain('<del>strikethrough</del>');
    });

    it('should handle empty markdown', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '',
        id: 'test-empty'
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle markdown with code blocks', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '```javascript\nconst x = 1;\n```',
        id: 'test-codeblocks'
      });

      expect(result).toContain('<code class="language-javascript">');
      expect(result).toContain('const x = 1;');
    });

    it('should handle inline code', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: 'This is `inline code`',
        id: 'test-inlinecode'
      });

      expect(result).toContain('<code>inline code</code>');
    });

    it('should handle blockquotes', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '> This is a quote',
        id: 'test-blockquotes'
      });

      expect(result).toContain('<blockquote>');
      expect(result).toContain('This is a quote');
    });

    it('should handle multiple headings', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '# H1\n## H2\n### H3',
        id: 'test-headings'
      });

      expect(result).toContain('<h1>H1</h1>');
      expect(result).toContain('<h2>H2</h2>');
      expect(result).toContain('<h3>H3</h3>');
    });

    it('should sanitize dangerous HTML', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '<script>alert("xss")</script>',
        id: 'test-sanitize'
      });

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should handle frontmatter', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '---\ntitle: Test\n---\n# Content',
        id: 'test-frontmatter'
      });

      expect(result).toContain('<h1>Content</h1>');
      expect(result).not.toContain('title: Test');
    });

    it('should handle unicode characters', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '# Hello 世界 🌍',
        id: 'test-unicode'
      });

      expect(result).toContain('世界');
      expect(result).toContain('🌍');
    });

    it('should handle nested lists', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2',
        id: 'test-nestedlists'
      });

      expect(result).toContain('<ul>');
      expect(result).toContain('Item 1');
      expect(result).toContain('Nested 1');
    });

    it('should handle ordered lists', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '1. First\n2. Second\n3. Third',
        id: 'test-orderedlists'
      });

      expect(result).toContain('<ol>');
      expect(result).toContain('<li>First</li>');
      expect(result).toContain('<li>Second</li>');
    });

    it('should handle horizontal rules', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '---',
        id: 'test-hr'
      });

      expect(result).toContain('<hr>');
    });

    it('should handle complex nested markdown', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '# Header\n\n> Quote with **bold** and *italic*\n\n- List item with `code`',
        id: 'test-complex'
      });

      expect(result).toContain('<h1>Header</h1>');
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
      expect(result).toContain('<code>code</code>');
    });

    it('should proxy external images', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '![Image](https://external.com/image.png)',
        id: 'test-proxy'
      });

      expect(result).toContain('proxy.metorial.com');
    });

    it('should not proxy metorial images', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '![Image](https://metorial.com/image.png)',
        id: 'test-noproxy'
      });

      expect(result).toContain('https://metorial.com/image.png');
      expect(result).not.toContain('proxy');
    });

    it('should add target blank to external links', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '[External](https://external.com)',
        id: 'test-targetblank'
      });

      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
    });

    it('should not add target blank to metorial links', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '[Internal](https://metorial.com)',
        id: 'test-notargetblank'
      });

      expect(result).not.toContain('target="_blank"');
    });

    it('should handle invalid link URLs', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '[Link](not-a-valid-url)',
        id: 'test-invalidlink'
      });

      expect(result).toContain('href="#"');
    });

    it('should handle invalid image URLs', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '![Image](invalid:protocol)',
        id: 'test-invalidimage'
      });

      // Invalid protocol causes the src to be removed by sanitizer
      expect(result).toContain('<img');
      expect(result).toContain('alt="Image"');
    });
  });

  describe('caching behavior', () => {
    it('should use the same id for cache key', async () => {
      const markdown = '# Test Content';
      const id = 'cache-test-id';

      // First call
      const result1 = await markdownService.renderMarkdown({ markdown, id });

      // Second call with same id should return cached result
      const result2 = await markdownService.renderMarkdown({ markdown, id });

      expect(result1).toBe(result2);
    });

    it('should handle different markdown with same id', async () => {
      const id = 'same-id';

      const result1 = await markdownService.renderMarkdown({
        markdown: '# First',
        id
      });

      // With caching by id, this might return cached result
      const result2 = await markdownService.renderMarkdown({
        markdown: '# Second',
        id
      });

      // Both should be valid HTML
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should handle different ids with same markdown', async () => {
      const markdown = '# Same Content';

      const result1 = await markdownService.renderMarkdown({
        markdown,
        id: 'id-1'
      });

      const result2 = await markdownService.renderMarkdown({
        markdown,
        id: 'id-2'
      });

      // Both should produce valid HTML
      expect(result1).toContain('<h1>Same Content</h1>');
      expect(result2).toContain('<h1>Same Content</h1>');
    });
  });

  describe('error handling', () => {
    it('should handle malformed markdown gracefully', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '### Incomplete\n[broken](',
        id: 'test-error-malformed'
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle very long markdown', async () => {
      const longMarkdown = '# Header\n\n' + 'Lorem ipsum '.repeat(1000);
      const result = await markdownService.renderMarkdown({
        markdown: longMarkdown,
        id: 'test-error-long'
      });

      expect(result).toContain('<h1>Header</h1>');
      expect(result).toContain('Lorem ipsum');
    });

    it('should handle special HTML characters', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '# <>&"\' Test',
        id: 'test-error-special'
      });

      expect(result).toBeDefined();
    });

    it('should handle multiple consecutive blank lines', async () => {
      const result = await markdownService.renderMarkdown({
        markdown: '# Header\n\n\n\n\nParagraph',
        id: 'test-error-blank'
      });

      expect(result).toContain('<h1>Header</h1>');
      expect(result).toContain('Paragraph');
    });
  });

  describe('integration tests', () => {
    it('should handle complete document with all features', async () => {
      const markdown = `---
title: Test Document
---

# Main Header

This is a paragraph with **bold**, *italic*, and \`code\`.

## Subheader

> A blockquote with [a link](https://example.com)

### List

- Item 1
- Item 2
  - Nested item

### Code Block

\`\`\`javascript
function test() {
  return true;
}
\`\`\`

### Table

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |

### Task List

- [ ] Todo
- [x] Done

![Image](https://example.com/image.png)
`;

      const result = await markdownService.renderMarkdown({
        markdown,
        id: 'integration-test'
      });

      expect(result).toContain('<h1>Main Header</h1>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
      expect(result).toContain('<code>code</code>');
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<table>');
      expect(result).toContain('task-list-item');
      expect(result).toContain('<img');
      expect(result).not.toContain('title: Test Document');
    });
  });
});
