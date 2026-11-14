import { describe, expect, it } from 'vitest';
import { ActiveDocumentView } from './documentView';

let createView = (content: string) =>
  new ActiveDocumentView('doc_1', {
    getStateUpdate: async () => null,
    getFallbackMarkdown: async () => ({ title: 'Guide', content })
  });

describe('ActiveDocumentView', () => {
  it('reads aliased blocks', async () => {
    let view = createView('# Guide\n\nIntro\n\n```\na\n\nb\n```\n\n- one');
    let result = await view.read();

    expect(result).toMatchObject({
      title: 'Guide',
      totalBlocks: 3,
      hasMore: false,
      content: '[b1] Intro\n\n[b2] ```\na\n\nb\n```\n\n[b3] - one'
    });
  });

  it('applies operations to the shadow and assigns pending refs', async () => {
    let view = createView('# Guide\n\nIntro\n\nOutro');
    let results = await view.applyOperations({
      toolCallId: 'call_1',
      checkStale: false,
      operations: [
        { type: 'replace', target: 'b1', content: 'New intro' },
        { type: 'insert_after', target: 'b2', content: 'Appendix' },
        { type: 'delete', target: 'b9' }
      ]
    });

    expect(results.map(result => result.error)).toEqual([
      undefined,
      undefined,
      'Unknown block b9. Call read_document again.'
    ]);
    expect(view.toBody()).toBe('New intro\n\nOutro\n\nAppendix');
    expect(view.peekRef('b1')).toBe('op:call_1:0');
  });

  it('turns a full markdown rewrite into block operations', async () => {
    let view = createView('# Guide\n\nIntro\n\nOutro');
    await view.ensureLoaded();

    expect(view.diffMarkdown('# Handbook\n\nIntro\n\nOutro updated')).toEqual([
      { type: 'replace', target: '@title', content: 'Handbook' },
      { type: 'replace', target: 'b2', targetEnd: undefined, content: 'Outro updated' }
    ]);
  });
});
