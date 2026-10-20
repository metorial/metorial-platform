// @vitest-environment node
import { getSchema } from '@tiptap/core';
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { buildHeadlessExtensions, encodeYjsUpdate, yjsUpdateToMarkdown } from './index';

let text = (value: string, marks: string[] = []) => ({
  type: 'text',
  text: value,
  ...(marks.length ? { marks: marks.map(type => ({ type })) } : {})
});
let paragraph = (...content: unknown[]) => ({ type: 'paragraph', content });
let cell = (type: string, attrs: Record<string, unknown>, ...content: unknown[]) => ({
  type,
  attrs,
  content: [paragraph(...content)]
});
let row = (...content: unknown[]) => ({ type: 'tableRow', content });
let table = (...content: unknown[]) => ({ type: 'table', content });

let toMarkdown = (content: unknown[]) => {
  let ydoc = new Y.Doc();
  prosemirrorJSONToYXmlFragment(
    getSchema(buildHeadlessExtensions()),
    { type: 'doc', content },
    ydoc.getXmlFragment('body')
  );
  return yjsUpdateToMarkdown(encodeYjsUpdate(Y.encodeStateAsUpdate(ydoc)));
};

describe('markdown serialization without a DOM', () => {
  it('runs without browser globals', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('serializes html-only marks', () => {
    let markdown = toMarkdown([
      { type: 'heading', attrs: { level: 2 }, content: [text('Title', ['underline'])] },
      paragraph(
        text('hi', ['highlight']),
        text(' H'),
        text('2', ['subscript']),
        text('O x'),
        text('2', ['superscript']),
        text(' '),
        text('both', ['bold', 'underline'])
      )
    ]);

    expect(markdown).toBe(
      '## <u>Title</u>\n\n<mark>hi</mark> H<sub>2</sub>O x<sup>2</sup> **<u>both</u>**'
    );
  });

  it('serializes markdown tables and line breaks inside them', () => {
    let markdown = toMarkdown([
      table(
        row(cell('tableHeader', {}, text('A')), cell('tableHeader', {}, text('B'))),
        row(
          cell('tableCell', {}, text('1'), { type: 'hardBreak' }, text('2')),
          cell('tableCell', {}, text('3', ['underline']))
        )
      ),
      paragraph(text('one'), { type: 'hardBreak' }, text('two'))
    ]);

    expect(markdown).toBe('| A | B |\n| --- | --- |\n| 1<br>2 | <u>3</u> |\n\none\\\ntwo');
  });

  it('keeps attribute and text values inside the html block', () => {
    let payload = '\n\n<script>alert(1)</script>\n\n';
    let markdown = toMarkdown([
      table(
        row(cell('tableHeader', { colspan: 2 }, text('h'))),
        row(
          cell(
            'tableCell',
            {},
            {
              type: 'text',
              text: 'link',
              marks: [{ type: 'link', attrs: { href: `https://example.com/${payload}` } }]
            }
          ),
          cell('tableCell', {}, text(`text${payload}`))
        )
      )
    ]);

    expect(markdown).not.toContain('<script');
    expect(markdown).not.toContain('\n\n<');
    expect(markdown).toContain('href="https://example.com/&#10;&#10;&lt;script&gt;');
  });

  it('only writes known callout tags', () => {
    let markdown = toMarkdown([
      { type: 'callout', attrs: { type: 'script' }, content: [paragraph(text('x'))] }
    ]);

    expect(markdown).toBe('<info>\n\nx\n\n</info>');
  });

  it('falls back to escaped html for tables markdown cannot express', () => {
    let markdown = toMarkdown([
      table(
        row(cell('tableHeader', { colspan: 2 }, text('Wide'))),
        row(cell('tableCell', {}, text('x', ['bold'])), cell('tableCell', {}, text('a & <b>')))
      )
    ]);

    expect(markdown).toBe(
      [
        '<table class="editor-table" style="min-width: 50px">',
        '<colgroup><col style="min-width: 25px"><col style="min-width: 25px"></colgroup>' +
          '<tbody><tr><th colspan="2"><p>Wide</p></th></tr>' +
          '<tr><td><p><strong>x</strong></p></td><td><p>a &amp; &lt;b&gt;</p></td></tr></tbody>',
        '</table>'
      ].join('\n')
    );
  });
});
