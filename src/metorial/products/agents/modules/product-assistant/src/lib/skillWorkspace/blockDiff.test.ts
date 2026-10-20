import { describe, expect, it } from 'vitest';
import { diffBlocks } from './blockDiff';

let blocks = [
  { alias: 'b1', markdown: '## Usage' },
  { alias: 'b2', markdown: 'First paragraph.' },
  { alias: 'b3', markdown: '- one\n- two' },
  { alias: 'b4', markdown: 'Last paragraph.' }
];

let join = (values: string[]) => values.join('\n\n');

describe('diffBlocks', () => {
  it('returns nothing for unchanged content', () => {
    expect(diffBlocks({ blocks, next: join(blocks.map(block => block.markdown)) })).toEqual(
      []
    );
  });

  it('replaces a single changed block', () => {
    expect(
      diffBlocks({
        blocks,
        next: join(['## Usage', 'Changed paragraph.', '- one\n- two', 'Last paragraph.'])
      })
    ).toEqual([
      { type: 'replace', target: 'b2', targetEnd: undefined, content: 'Changed paragraph.' }
    ]);
  });

  it('expands edits inside a multi-line block to the whole block', () => {
    expect(
      diffBlocks({
        blocks,
        next: join([
          '## Usage',
          'First paragraph.',
          '- one\n- two\n- three',
          'Last paragraph.'
        ])
      })
    ).toEqual([
      { type: 'replace', target: 'b3', targetEnd: undefined, content: '- one\n- two\n- three' }
    ]);
  });

  it('keeps distant edits as separate operations', () => {
    expect(
      diffBlocks({
        blocks,
        next: join(['## Setup', 'First paragraph.', '- one\n- two', 'Final paragraph.'])
      })
    ).toEqual([
      { type: 'replace', target: 'b1', targetEnd: undefined, content: '## Setup' },
      { type: 'replace', target: 'b4', targetEnd: undefined, content: 'Final paragraph.' }
    ]);
  });

  it('inserts new blocks between existing ones', () => {
    expect(
      diffBlocks({
        blocks,
        next: join([
          '## Usage',
          'First paragraph.',
          'Inserted.',
          '- one\n- two',
          'Last paragraph.'
        ])
      })
    ).toEqual([{ type: 'insert_after', target: 'b2', content: 'Inserted.' }]);
  });

  it('deletes removed blocks', () => {
    expect(
      diffBlocks({
        blocks,
        next: join(['## Usage', '- one\n- two', 'Last paragraph.'])
      })
    ).toEqual([{ type: 'delete', target: 'b2', targetEnd: undefined }]);
  });

  it('inserts into an empty document', () => {
    expect(diffBlocks({ blocks: [], next: 'Hello' })).toEqual([
      { type: 'insert_after', target: 'doc_end', content: 'Hello' }
    ]);
  });
});
