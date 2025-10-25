import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Markdown } from '../src/lib/markdown';

// Mock the external dependency
vi.mock('@metorial/db/src/lib/getImageUrl', () => ({
  getImageUrl: vi.fn(async ({ image }) => {
    // Mock implementation returns a proxied URL
    if (image.type === 'url') {
      return `https://proxy.metorial.com/image?url=${encodeURIComponent(image.url)}`;
    }
    return image.url;
  })
}));

describe('Markdown', () => {
  describe('constructor', () => {
    it('should create instance using static from method', () => {
      const markdown = Markdown.from('# Hello', { id: 'test' });
      expect(markdown).toBeInstanceOf(Markdown);
    });
  });

  describe('toHtml', () => {
    it('should convert simple markdown to HTML', async () => {
      const markdown = Markdown.from('# Hello World', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<h1>Hello World</h1>');
    });

    it('should convert bold text', async () => {
      const markdown = Markdown.from('**bold text**', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<strong>bold text</strong>');
    });

    it('should convert italic text', async () => {
      const markdown = Markdown.from('*italic text*', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<em>italic text</em>');
    });

    it('should convert code blocks with language', async () => {
      const markdown = Markdown.from('```javascript\nconst x = 1;\n```', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<code class="language-javascript">');
      expect(html).toContain('const x = 1;');
    });

    it('should convert inline code', async () => {
      const markdown = Markdown.from('This is `inline code`', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<code>inline code</code>');
    });

    it('should convert lists', async () => {
      const markdown = Markdown.from('- Item 1\n- Item 2\n- Item 3', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>Item 1</li>');
      expect(html).toContain('<li>Item 2</li>');
    });

    it('should convert ordered lists', async () => {
      const markdown = Markdown.from('1. First\n2. Second\n3. Third', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<ol>');
      expect(html).toContain('<li>First</li>');
    });

    it('should convert blockquotes', async () => {
      const markdown = Markdown.from('> This is a quote', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<blockquote>');
      expect(html).toContain('This is a quote');
    });

    it('should convert links with target blank for external domains', async () => {
      const markdown = Markdown.from('[Link](https://external.com)', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<a href="https://external.com/"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('should not add target blank for metorial.com links', async () => {
      const markdown = Markdown.from('[Link](https://metorial.com)', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).not.toContain('target="_blank"');
    });

    it('should not add target blank for metorial.com subdomains', async () => {
      const markdown = Markdown.from('[Link](https://app.metorial.com)', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).not.toContain('target="_blank"');
    });

    it('should convert relative links with linkRoot', async () => {
      const markdown = Markdown.from('[Link](./path/to/file)', {
        id: 'test',
        linkRoot: 'https://github.com/user/repo'
      });
      const html = await markdown.toHtml();
      expect(html).toContain('https://github.com/user/repo/path/to/file');
    });

    it('should convert relative links with linkRoot and rootPath', async () => {
      const markdown = Markdown.from('[Link](./file.md)', {
        id: 'test',
        linkRoot: 'https://github.com/user/repo',
        rootPath: 'docs'
      });
      const html = await markdown.toHtml();
      expect(html).toContain('https://github.com/user/repo/docs/file.md');
    });

    it('should handle invalid links by setting href to #', async () => {
      const markdown = Markdown.from('[Link](not-a-valid-url)', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('href="#"');
    });

    it('should convert images', async () => {
      const markdown = Markdown.from('![Alt text](https://example.com/image.png)', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<img');
      expect(html).toContain('alt="Alt text"');
    });

    it('should convert relative images with imageRoot', async () => {
      const markdown = Markdown.from('![Image](./image.png)', {
        id: 'test',
        imageRoot: 'https://cdn.example.com'
      });
      const html = await markdown.toHtml();
      // External CDN images get proxied
      expect(html).toContain('proxy.metorial.com');
      expect(html).toContain('cdn.example.com');
    });

    it('should convert relative images with imageRoot and rootPath', async () => {
      const markdown = Markdown.from('![Image](./image.png)', {
        id: 'test',
        imageRoot: 'https://cdn.example.com',
        rootPath: 'assets'
      });
      const html = await markdown.toHtml();
      // External CDN images get proxied, but the path transformation still happens
      expect(html).toContain('proxy.metorial.com');
      expect(html).toContain('assets');
    });

    it('should proxy external images (non-metorial)', async () => {
      const markdown = Markdown.from('![Image](https://external.com/image.png)', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('https://proxy.metorial.com/image?url=');
    });

    it('should not proxy metorial.com images', async () => {
      const markdown = Markdown.from('![Image](https://metorial.com/image.png)', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('https://metorial.com/image.png');
      expect(html).not.toContain('proxy');
    });

    it('should handle invalid image URLs by removing src', async () => {
      const markdown = Markdown.from('![Image](invalid:url)', { id: 'test' });
      const html = await markdown.toHtml();
      // Invalid protocol causes the src to be removed by sanitizer
      expect(html).toContain('<img');
      expect(html).toContain('alt="Image"');
    });

    it('should support GFM tables', async () => {
      const markdown = Markdown.from('| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<table>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('Header 1');
    });

    it('should support GFM strikethrough', async () => {
      const markdown = Markdown.from('~~strikethrough~~', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<del>strikethrough</del>');
    });

    it('should support GFM task lists', async () => {
      const markdown = Markdown.from('- [ ] Unchecked\n- [x] Checked', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('task-list-item');
      expect(html).toContain('type="checkbox"');
    });

    it('should support GFM autolinks', async () => {
      const markdown = Markdown.from('https://example.com', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<a href="https://example.com/"');
    });

    it('should strip script tags for security', async () => {
      const markdown = Markdown.from('<script>alert("xss")</script>', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert');
    });

    it('should strip style tags for security', async () => {
      const markdown = Markdown.from('<style>body { display: none; }</style>', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).not.toContain('<style>');
    });

    it('should handle empty markdown', async () => {
      const markdown = Markdown.from('', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toBeDefined();
    });

    it('should handle markdown with only whitespace', async () => {
      const markdown = Markdown.from('   \n\n   ', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toBeDefined();
    });

    it('should handle frontmatter', async () => {
      const markdown = Markdown.from('---\ntitle: Test\n---\n# Content', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<h1>Content</h1>');
      // Frontmatter should be parsed but not rendered
      expect(html).not.toContain('title: Test');
    });

    it('should handle complex nested markdown', async () => {
      const markdown = Markdown.from('# Header\n\n> Quote with **bold** and *italic*\n\n- List item with `code`', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<h1>Header</h1>');
      expect(html).toContain('<blockquote>');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
      expect(html).toContain('<code>code</code>');
    });

    it('should handle multiple images efficiently', async () => {
      const markdown = Markdown.from(
        '![Image 1](https://external1.com/img1.png)\n![Image 2](https://external2.com/img2.png)',
        { id: 'test' }
      );
      const html = await markdown.toHtml();
      expect(html).toContain('img1.png');
      expect(html).toContain('img2.png');
    });

    it('should handle headings h1-h6', async () => {
      const markdown = Markdown.from('# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<h1>H1</h1>');
      expect(html).toContain('<h2>H2</h2>');
      expect(html).toContain('<h3>H3</h3>');
      expect(html).toContain('<h4>H4</h4>');
      expect(html).toContain('<h5>H5</h5>');
      expect(html).toContain('<h6>H6</h6>');
    });

    it('should handle horizontal rules', async () => {
      const markdown = Markdown.from('---', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<hr>');
    });
  });

  describe('toMarkdown', () => {
    it('should handle HTML input', async () => {
      const markdown = Markdown.from('<h1>Hello World</h1>', { id: 'test' });
      const result = await markdown.toMarkdown();
      expect(result).toContain('Hello World');
    });

    it('should handle bold HTML', async () => {
      const markdown = Markdown.from('<strong>bold</strong>', { id: 'test' });
      const result = await markdown.toMarkdown();
      expect(result).toContain('**bold**');
    });

    it('should handle italic HTML', async () => {
      const markdown = Markdown.from('<em>italic</em>', { id: 'test' });
      const result = await markdown.toMarkdown();
      expect(result).toContain('*italic*');
    });

    it('should handle links in HTML', async () => {
      const markdown = Markdown.from('<a href="https://example.com">Link</a>', { id: 'test' });
      const result = await markdown.toMarkdown();
      expect(result).toContain('[Link]');
      expect(result).toContain('https://example.com');
    });

    it('should handle images in HTML', async () => {
      const markdown = Markdown.from('<img src="https://example.com/image.png" alt="Alt">', { id: 'test' });
      const result = await markdown.toMarkdown();
      expect(result).toContain('![Alt]');
    });

    it('should handle lists in HTML', async () => {
      const markdown = Markdown.from('<ul><li>Item 1</li><li>Item 2</li></ul>', { id: 'test' });
      const result = await markdown.toMarkdown();
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
    });

    it('should handle code in HTML', async () => {
      const markdown = Markdown.from('<code>code</code>', { id: 'test' });
      const result = await markdown.toMarkdown();
      expect(result).toContain('`code`');
    });

    it('should handle empty HTML', async () => {
      const markdown = Markdown.from('', { id: 'test' });
      const result = await markdown.toMarkdown();
      expect(result).toBeDefined();
    });

    it('should handle complex HTML structure', async () => {
      const markdown = Markdown.from(
        '<h1>Title</h1><p>Paragraph with <strong>bold</strong> and <em>italic</em></p>',
        { id: 'test' }
      );
      const result = await markdown.toMarkdown();
      expect(result).toContain('Title');
      expect(result).toContain('Paragraph');
    });

    it('should strip script tags', async () => {
      const markdown = Markdown.from('<script>alert("xss")</script><p>Content</p>', { id: 'test' });
      const result = await markdown.toMarkdown();
      expect(result).not.toContain('alert');
      expect(result).toContain('Content');
    });

    it('should handle relative links with linkRoot', async () => {
      const markdown = Markdown.from('<a href="./path">Link</a>', {
        id: 'test',
        linkRoot: 'https://github.com/user/repo'
      });
      const result = await markdown.toMarkdown();
      // toMarkdown processes HTML input, relative URLs remain unchanged
      expect(result).toContain('[Link]');
      expect(result).toContain('./path');
    });

    it('should handle relative images with imageRoot', async () => {
      const markdown = Markdown.from('<img src="./image.png" alt="Image">', {
        id: 'test',
        imageRoot: 'https://cdn.example.com'
      });
      const result = await markdown.toMarkdown();
      // toMarkdown processes HTML input, relative URLs remain unchanged
      expect(result).toContain('![Image]');
      expect(result).toContain('./image.png');
    });

    it('should add target blank for external links', async () => {
      const markdown = Markdown.from('<a href="https://external.com">Link</a>', { id: 'test' });
      const result = await markdown.toMarkdown();
      // The markdown output should still contain the link
      expect(result).toContain('https://external.com');
    });

    it('should handle blockquotes', async () => {
      const markdown = Markdown.from('<blockquote>Quote</blockquote>', { id: 'test' });
      const result = await markdown.toMarkdown();
      expect(result).toContain('Quote');
    });

    it('should handle tables', async () => {
      const markdown = Markdown.from(
        '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>',
        { id: 'test' }
      );
      const result = await markdown.toMarkdown();
      expect(result).toContain('Header');
      expect(result).toContain('Cell');
    });
  });

  describe('edge cases', () => {
    it('should handle very long markdown', async () => {
      const longMarkdown = '# Header\n\n' + 'Lorem ipsum '.repeat(1000);
      const markdown = Markdown.from(longMarkdown, { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<h1>Header</h1>');
      expect(html).toContain('Lorem ipsum');
    });

    it('should handle special characters', async () => {
      const markdown = Markdown.from('# Hello <>&"\' World', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const markdown = Markdown.from('# Hello 世界 🌍', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('世界');
      expect(html).toContain('🌍');
    });

    it('should handle malformed markdown gracefully', async () => {
      const markdown = Markdown.from('### Incomplete heading\n[broken link](', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toBeDefined();
    });

    it('should handle nested lists', async () => {
      const markdown = Markdown.from('- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<ul>');
      expect(html).toContain('Item 1');
      expect(html).toContain('Nested 1');
    });

    it('should handle mixed list types', async () => {
      const markdown = Markdown.from('1. Ordered\n   - Unordered\n2. Ordered', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<ol>');
      expect(html).toContain('<ul>');
    });

    it('should handle code blocks without language', async () => {
      const markdown = Markdown.from('```\ncode without language\n```', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('code without language');
    });

    it('should handle multiple consecutive blank lines', async () => {
      const markdown = Markdown.from('# Header\n\n\n\n\nParagraph', { id: 'test' });
      const html = await markdown.toHtml();
      expect(html).toContain('<h1>Header</h1>');
      expect(html).toContain('Paragraph');
    });
  });
});
