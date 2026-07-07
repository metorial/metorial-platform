import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  composeFullMarkdown,
  markdownToYjsUpdate,
  yjsUpdateToDocumentSnapshot
} from './index';

let dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).DOMParser = dom.window.DOMParser;
(globalThis as any).Node = dom.window.Node;

describe('docs editor schema conversion', () => {
  it('round-trips common markdown through Yjs', () => {
    let input = [
      '# Hello',
      '',
      'A paragraph with **bold** text.',
      '',
      '- One',
      '- Two',
      '',
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |'
    ].join('\n');

    let update = markdownToYjsUpdate(input);
    expect(update).toBeTruthy();

    let snapshot = yjsUpdateToDocumentSnapshot(update!);
    expect(snapshot.body).toContain('# Hello');
    expect(snapshot.body).toContain('**bold**');
    expect(snapshot.body).toContain('- One');
    expect(snapshot.body).toContain('| A | B |');
  });

  it('preserves custom callout and equation markdown', () => {
    let input = [
      '<info>',
      '',
      'Inside callout',
      '',
      '</info>',
      '',
      '<equation>x^2</equation>'
    ].join('\n');

    let update = markdownToYjsUpdate(input);
    expect(update).toBeTruthy();

    let snapshot = yjsUpdateToDocumentSnapshot(update!);
    expect(snapshot.body).toContain('<info>');
    expect(snapshot.body).toContain('Inside callout');
    expect(snapshot.body).toContain('</info>');
    expect(snapshot.body).toContain('<equation>x^2</equation>');
  });

  it('composes full persisted markdown', () => {
    expect(
      composeFullMarkdown({
        frontMatter: 'slug: hello',
        title: 'Hello',
        body: 'Body'
      })
    ).toBe('---\nslug: hello\n---\n\n# Hello\n\nBody');
  });
});
