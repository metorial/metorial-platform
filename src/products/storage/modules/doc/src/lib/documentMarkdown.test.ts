import { describe, expect, it } from 'vitest';
import { rewriteDocumentMarkdownTitle } from './documentMarkdown';

describe('rewriteDocumentMarkdownTitle', () => {
  it('replaces an existing leading title', () => {
    expect(rewriteDocumentMarkdownTitle('# Template Skill\n\nBody', 'Created Skill')).toBe(
      '# Created Skill\n\nBody'
    );
  });

  it('preserves frontmatter and body content', () => {
    expect(
      rewriteDocumentMarkdownTitle(
        '---\ndescription: A template\n---\n\n# Template Skill\n\nBody',
        'Created Skill'
      )
    ).toBe('---\ndescription: A template\n---\n\n# Created Skill\n\nBody');
  });

  it('adds a title when the content has no leading title', () => {
    expect(rewriteDocumentMarkdownTitle('Body', 'Created Skill')).toBe(
      '# Created Skill\n\nBody'
    );
  });
});
