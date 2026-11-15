// @vitest-environment node
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { markdownCorpus } from './markdownCorpus';
import {
  buildHeadlessExtensions,
  decodeYjsUpdate,
  encodeYjsUpdate,
  getDocumentBodyMarkdown,
  HtmlDepthError,
  markdownToDoc,
  markdownToYjsUpdate,
  reconcileDocumentBody,
  replaceYjsBodyFromMarkdown,
  yjsUpdateToDocumentBody,
  yjsUpdateToMarkdown
} from './index';
import { headlessSchema } from './testing/legacyMarkdown';

let schema = headlessSchema();

let parse = (markdown: string) => markdownToDoc(markdown, schema);

let json = (markdown: string) => parse(markdown).toJSON();

let types = (markdown: string) => {
  let found: string[] = [];
  parse(markdown).descendants(node => {
    found.push(node.type.name);
  });
  return found;
};

let marksOf = (markdown: string) => {
  let found = new Set<string>();
  parse(markdown).descendants(node => node.marks.forEach(mark => found.add(mark.type.name)));
  return [...found].sort();
};

let docToMarkdown = (doc: unknown) => {
  let ydoc = new Y.Doc();
  prosemirrorJSONToYXmlFragment(
    schema,
    doc as Record<string, unknown>,
    ydoc.getXmlFragment('body')
  );

  let markdown = yjsUpdateToMarkdown(encodeYjsUpdate(Y.encodeStateAsUpdate(ydoc)));
  ydoc.destroy();
  return markdown;
};

let withDomTrap = <T>(run: () => T) => {
  let keys = ['window', 'document', 'DOMParser', 'Node', 'navigator', 'HTMLElement'];
  let touched: string[] = [];
  let previous = keys.map(
    key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const
  );

  for (let key of keys) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: () => {
        touched.push(key);
        return undefined;
      }
    });
  }

  try {
    return { result: run(), touched };
  } finally {
    for (let [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
  }
};

describe('markdown import without a DOM', () => {
  it('runs without browser globals', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(typeof DOMParser).toBe('undefined');
  });

  it('never touches browser globals across the whole corpus', () => {
    let { touched } = withDomTrap(() => {
      for (let markdown of Object.values(markdownCorpus)) {
        if (markdown.trim()) markdownToYjsUpdate(markdown);
      }
    });

    expect(touched).toEqual([]);
  });

  it('never touches browser globals when reconciling stored documents', () => {
    let { touched } = withDomTrap(() => {
      let body = reconcileDocumentBody({
        previous: null,
        next: { title: 'T', content: '# T\n\n<info>\n\nx\n\n</info>\n\n| A |\n| - |\n| 1 |' },
        actorIds: ['usr_1']
      });
      return reconcileDocumentBody({
        previous: { title: 'T', content: body.content, annotations: body.annotations },
        next: { title: 'T', content: '# T\n\nchanged\n\n<u>u</u>' },
        actorIds: ['usr_1']
      });
    });

    expect(touched).toEqual([]);
  });

  it('does not leave browser globals behind after use', () => {
    markdownToYjsUpdate('# hi\n\n<info>\n\nx\n\n</info>');

    expect(typeof (globalThis as any).window).toBe('undefined');
    expect(typeof (globalThis as any).document).toBe('undefined');
    expect(typeof (globalThis as any).DOMParser).toBe('undefined');
    expect(typeof (globalThis as any).Node).toBe('undefined');
  });

  it('is safe to run concurrently interleaved with async work', async () => {
    let results = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        let update = markdownToYjsUpdate(`# Doc ${i}\n\n<info>\n\nbody ${i}\n\n</info>`);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        return yjsUpdateToMarkdown(update!);
      })
    );

    results.forEach((markdown, i) => {
      expect(markdown).toContain(`# Doc ${i}`);
      expect(markdown).toContain(`body ${i}`);
    });
  });
});

describe('markdown import semantics', () => {
  it('returns an empty document for empty input', () => {
    expect(parse('').childCount).toBe(1);
    expect(markdownToYjsUpdate('   \n\n  ')).toBeNull();
  });

  it('parses headings, paragraphs and soft breaks', () => {
    expect(json('# A\n\nline one\nline two')).toMatchObject({
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ text: 'A' }] },
        { type: 'paragraph', content: [{ text: 'line one line two' }] }
      ]
    });
  });

  it('parses hard breaks', () => {
    expect(types('one\\\ntwo')).toEqual(['paragraph', 'text', 'hardBreak', 'text']);
  });

  it('parses every callout type from tag form', () => {
    for (let type of ['info', 'warning', 'success', 'danger']) {
      let doc = json(`<${type}>\n\nBody\n\n</${type}>`);

      expect(doc.content[0]).toMatchObject({ type: 'callout', attrs: { type } });
    }
  });

  it('parses callouts from the div form and falls back to info for unknown types', () => {
    expect(json('<div data-callout-type="danger"><p>x</p></div>').content[0].attrs.type).toBe(
      'danger'
    );
    expect(json('<div data-callout-type="bogus"><p>x</p></div>').content[0].attrs.type).toBe(
      'info'
    );
  });

  it('nests markdown blocks inside callouts', () => {
    let doc = json('<warning>\n\nIntro\n\n- a\n- b\n\n```js\nx\n```\n\n</warning>');

    expect(doc.content[0].content.map((node: any) => node.type)).toEqual([
      'paragraph',
      'bulletList',
      'codeBlock'
    ]);
  });

  it('parses equations from tag and div forms', () => {
    expect(json('<equation>x^2</equation>').content[0]).toMatchObject({
      type: 'equationBlock',
      attrs: { latex: 'x^2' }
    });
    expect(json('<div data-equation-block data-latex="a+b"></div>').content[0]).toMatchObject({
      type: 'equationBlock',
      attrs: { latex: 'a+b' }
    });
  });

  it('keeps html-only marks', () => {
    expect(marksOf('<u>a</u> <mark>b</mark> H<sub>2</sub> x<sup>2</sup>')).toEqual([
      'highlight',
      'subscript',
      'superscript',
      'underline'
    ]);
  });

  it('parses markdown marks and links with their attributes', () => {
    let doc = json('**b** *i* ~~s~~ `c` [l](https://example.com "t")');
    let text = doc.content[0].content;

    expect(text[0].marks[0].type).toBe('bold');
    expect(text.at(-1).marks[0]).toMatchObject({
      type: 'link',
      attrs: { href: 'https://example.com' }
    });
  });

  it('parses task lists with checked state', () => {
    let list = json('- [ ] a\n- [x] b').content[0];

    expect(list.type).toBe('taskList');
    expect(list.content.map((item: any) => item.attrs.checked)).toEqual([false, true]);
  });

  it('parses nested task lists', () => {
    let doc = json('- [ ] parent\n  - [x] child');
    let nested = doc.content[0].content[0].content.find(
      (node: any) => node.type == 'taskList'
    );

    expect(nested.content[0].attrs.checked).toBe(true);
  });

  it('parses ordered list start values', () => {
    expect(json('5. a\n6. b').content[0].attrs.start).toBe(5);
  });

  it('parses code block languages and keeps whitespace', () => {
    let doc = json('```ts\n  indented\n\n  more\n```');

    expect(doc.content[0].attrs.language).toBe('ts');
    expect(doc.content[0].content[0].text).toBe('  indented\n\n  more');
  });

  it('defaults code blocks without a language to plaintext', () => {
    expect(json('```\nx\n```').content[0].attrs.language).toBe('plaintext');
  });

  it('parses markdown tables into header and body rows', () => {
    let table = json('| A | B |\n| - | - |\n| 1 | 2 |').content[0];

    expect(table.type).toBe('table');
    expect(table.content[0].content.map((cell: any) => cell.type)).toEqual([
      'tableHeader',
      'tableHeader'
    ]);
    expect(table.content[1].content.map((cell: any) => cell.type)).toEqual([
      'tableCell',
      'tableCell'
    ]);
  });

  it('parses html tables with spans and column widths', () => {
    let table = json(
      '<table><tr><th colspan="2" colwidth="120,80">H</th></tr><tr><td>a</td><td>b</td></tr></table>'
    ).content[0];
    let header = table.content[0].content[0];

    expect(header.attrs).toMatchObject({ colspan: 2, colwidth: [120, 80] });
  });

  it('hoists block images out of paragraphs', () => {
    expect(types('before ![a](https://e.com/a.png) after')).toEqual([
      'paragraph',
      'text',
      'image',
      'paragraph',
      'text'
    ]);
  });

  it('parses text alignment from inline styles', () => {
    expect(json('<p style="text-align: center">x</p>').content[0].attrs.textAlign).toBe(
      'center'
    );
  });

  it('ignores unknown elements but keeps their text and known descendants', () => {
    let doc = json('<custom-tag>unknown <b>bold</b></custom-tag>');

    expect(doc.content[0].content[0].text).toBe('unknown ');
    expect(doc.content[0].content[1].marks[0].type).toBe('bold');
  });

  it('handles windows line endings', () => {
    expect(types('a\r\n\r\nb\r\n\r\n- x\r\n- y')).toEqual([
      'paragraph',
      'text',
      'paragraph',
      'text',
      'bulletList',
      'listItem',
      'paragraph',
      'text',
      'listItem',
      'paragraph',
      'text'
    ]);
  });

  it('preserves unicode and entities', () => {
    expect(parse('héllo 日本語 🎉 &amp; &copy;').textContent).toBe('héllo 日本語 🎉 & ©');
  });
});

describe('markdown import hardening', () => {
  it('drops script, style and iframe elements', () => {
    let markdown =
      'a <script>alert(1)</script> b\n\n<style>p{}</style>\n\n<iframe src="https://evil.example"></iframe>\n\nend';

    expect(
      types(markdown).filter(type => !['doc', 'paragraph', 'text'].includes(type))
    ).toEqual([]);
  });

  it('does not carry event handler or unknown attributes into the document', () => {
    let serialized = JSON.stringify(
      json(
        '<img src="x" onerror="alert(1)" onload="x()">\n\n<info onclick="x()">\n\nhi\n\n</info>'
      )
    );

    expect(serialized).not.toContain('onerror');
    expect(serialized).not.toContain('onclick');
    expect(serialized).not.toContain('onload');
  });

  it('does not allow forged editor-only nodes or marks', () => {
    let markdown = [
      '<div data-agent-block="true" data-block-id="x"><p>forged</p></div>',
      '',
      '<div data-image-placeholder data-id="x"></div>',
      '',
      'a <span data-comment-thread data-thread-id="thr_1">anchored</span> b'
    ].join('\n');

    let found = [...types(markdown), ...marksOf(markdown)];

    expect(found).not.toContain('agentBlock');
    expect(found).not.toContain('imagePlaceholder');
    expect(found).not.toContain('commentThread');
    expect(parse(markdown).textContent).toContain('anchored');
  });

  it('treats html in code spans and fences as literal text', () => {
    let doc = json('`<info>` and\n\n```html\n<info>x</info>\n```');

    expect(types('`<info>`')).not.toContain('callout');
    expect(doc.content[1].content[0].text).toBe('<info>x</info>');
  });

  it('rejects pathologically deep html with a typed error', () => {
    expect(() => parse('<div>'.repeat(1000))).toThrow(HtmlDepthError);
  });

  it('survives deep markdown nesting without a stack overflow', () => {
    expect(() => parse('> '.repeat(500) + 'deep')).not.toThrow();
    expect(() => parse('- '.repeat(300) + 'deep')).not.toThrow();
    expect(() => parse('['.repeat(2000) + 'x' + ']'.repeat(2000))).not.toThrow();
  });

  it('survives unbalanced and garbage html', () => {
    for (let markdown of [
      '<',
      '<<<>>>',
      '</p></div></info>',
      '<info>'.repeat(50),
      '<a href="',
      '<!--',
      '<![CDATA[x]]>',
      '<?php echo 1 ?>',
      '&#xFFFFFFFF; &#0; &bogus;',
      '\u0000\u0001\u0002 control',
      '<table><tr><td><table><tr><td>nested'
    ]) {
      expect(() => parse(markdown), markdown).not.toThrow();
    }
  });

  it('always produces a schema-valid document', () => {
    for (let markdown of Object.values(markdownCorpus)) {
      expect(() => parse(markdown).check(), markdown).not.toThrow();
    }
  });

  it('parses large documents quickly', () => {
    let markdown = Array.from(
      { length: 3000 },
      (_, i) =>
        `## Heading ${i}\n\nParagraph with **bold** and [link](https://e.com/${i}).\n\n- a\n- b`
    ).join('\n\n');

    let started = performance.now();
    let doc = parse(markdown);
    let elapsed = performance.now() - started;

    expect(doc.childCount).toBe(9000);
    expect(elapsed).toBeLessThan(8000);
  });

  it('parses wide tables and long lines', () => {
    let row = (cell: string) => `| ${Array.from({ length: 60 }, () => cell).join(' | ')} |`;
    let table = [row('h'), row('-'), ...Array.from({ length: 200 }, () => row('c'))].join(
      '\n'
    );

    expect(parse(table).firstChild!.childCount).toBe(201);
    expect(parse('word '.repeat(100_000)).textContent.length).toBeGreaterThan(400_000);
  });
});

describe('markdown round trips', () => {
  let stable = [
    'paragraph',
    'headings',
    'emphasis',
    'link',
    'bulletList',
    'orderedList',
    'nestedLists',
    'taskList',
    'blockquote',
    'codeBlockLang',
    'horizontalRule',
    'table',
    'callout',
    'calloutAllTypes',
    'equation',
    'underline',
    'highlight',
    'subSup',
    'htmlTable'
  ];

  let knownUnstable = [
    'tableEscapedPipe',
    'htmlTableMultiParagraph',
    'calloutInBlockquote',
    'htmlSvg',
    'codeBlockNbspLanguage',
    'mixedDocument'
  ];

  for (let name of stable) {
    it(`is stable for ${name}`, () => {
      let first = parse(markdownCorpus[name]!).toJSON();
      let second = parse(docToMarkdown(first)).toJSON();

      expect(second).toEqual(first);
    });
  }

  it('converges to a fixed point for the whole corpus after one round trip', () => {
    for (let [name, markdown] of Object.entries(markdownCorpus)) {
      if (!markdown.trim() || knownUnstable.includes(name)) continue;

      let once = docToMarkdown(parse(markdown).toJSON());
      let twice = docToMarkdown(parse(once).toJSON());

      expect(twice, name).toEqual(once);
    }
  });

  describe('known serializer issues that predate the parser', () => {
    it.fails('separates a block image from the node that follows it', () => {
      let doc = parse('![img](https://example.com/i.png)\n\n---\n\nafter').toJSON();

      expect(parse(docToMarkdown(doc)).toJSON()).toEqual(doc);
    });

    it.fails('escapes pipes inside markdown table cells', () => {
      let doc = parse('| A |\n| - |\n| a \\| b |').toJSON();

      expect(parse(docToMarkdown(doc)).toJSON()).toEqual(doc);
    });
  });

  it('keeps callout content and equations through yjs and back', () => {
    let update = markdownToYjsUpdate(markdownCorpus.mixedDocument!)!;
    let markdown = yjsUpdateToMarkdown(update);

    expect(markdown).toContain('<info>');
    expect(markdown).toContain('<equation>x^2 + y^2</equation>');
    expect(markdown).toContain('- [x] done');
    expect(markdown).toContain('| A | B |');
    expect(markdown).toContain('H<sub>2</sub>O');
  });

  it('replaces a live body and reflects the new markdown', () => {
    let ydoc = new Y.Doc();
    Y.applyUpdate(
      ydoc,
      decodeYjsUpdate(markdownToYjsUpdate('old\n\n<info>\n\nold callout\n\n</info>')!)
    );

    replaceYjsBodyFromMarkdown({ ydoc, markdown: '# New\n\n- [x] done' });

    let markdown = yjsUpdateToMarkdown(encodeYjsUpdate(Y.encodeStateAsUpdate(ydoc)));
    expect(markdown).toContain('# New');
    expect(markdown).toContain('- [x] done');
    expect(markdown).not.toContain('old');
    ydoc.destroy();
  });

  it('round-trips a stored document body through the live state', () => {
    let content = '---\nslug: x\n---\n\n# Title\n\n<info>\n\nBody\n\n</info>\n\nText';
    let { body } = getDocumentBodyMarkdown({ content, title: 'Title' });
    let update = markdownToYjsUpdate(body)!;
    let stored = yjsUpdateToDocumentBody(update, { title: 'Title', frontMatter: 'slug: x' });

    expect(stored.body.content).toContain('<info>');
    expect(stored.body.content).toContain('# Title');
    expect(stored.frontMatter).toBe('slug: x');
  });

  it('produces identical updates for repeated imports of the same markdown', () => {
    let first = markdownToYjsUpdate(markdownCorpus.mixedDocument!);
    let second = markdownToYjsUpdate(markdownCorpus.mixedDocument!);

    expect(yjsUpdateToMarkdown(first!)).toEqual(yjsUpdateToMarkdown(second!));
  });

  it('does not share state between consecutive imports', () => {
    markdownToYjsUpdate('<info>\n\nunclosed');

    expect(types('plain')).toEqual(['paragraph', 'text']);
    expect(buildHeadlessExtensions().length).toBeGreaterThan(0);
  });
});
