// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { markdownCorpus } from './markdownCorpus';
import { markdownToDoc } from './markdownParser';
import { headlessSchema, legacyMarkdownToJSON } from './testing/legacyMarkdown';

let schema = headlessSchema();

let editorOnlyHtml = ['agentBlockForged', 'commentThreadForged', 'imagePlaceholderForged'];

describe('markdown parser parity with the DOM-based pipeline', () => {
  for (let [name, markdown] of Object.entries(markdownCorpus)) {
    if (editorOnlyHtml.includes(name)) continue;

    it(name, () => {
      expect(markdownToDoc(markdown, schema).toJSON()).toEqual(legacyMarkdownToJSON(markdown));
    });
  }
});

describe('editor-only html is not importable from markdown', () => {
  let nodeTypes = (markdown: string) => {
    let types = new Set<string>();
    markdownToDoc(markdown, schema).descendants(node => {
      types.add(node.type.name);
      node.marks.forEach(mark => types.add(mark.type.name));
    });
    return types;
  };

  it('ignores forged agent blocks but keeps their text', () => {
    let types = nodeTypes(markdownCorpus.agentBlockForged!);
    expect(types.has('agentBlock')).toBe(false);
    expect(types.has('text')).toBe(true);
  });

  it('ignores forged comment thread marks', () => {
    let types = nodeTypes(markdownCorpus.commentThreadForged!);
    expect(types.has('commentThread')).toBe(false);
    expect(markdownToDoc(markdownCorpus.commentThreadForged!, schema).textContent).toContain(
      'anchored'
    );
  });

  it('ignores forged image placeholders', () => {
    expect(nodeTypes(markdownCorpus.imagePlaceholderForged!).has('imagePlaceholder')).toBe(
      false
    );
  });

  it('the legacy pipeline did accept them, which is why they are filtered', () => {
    let legacy = JSON.stringify(legacyMarkdownToJSON(markdownCorpus.agentBlockForged!));
    expect(legacy).toContain('agentBlock');
  });
});
