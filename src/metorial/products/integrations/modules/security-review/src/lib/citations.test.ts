import { describe, expect, it } from 'vitest';
import { resolveCitation } from './citations';

let sources = {
  facts: [
    { id: 'slate-origin', title: 'Built by Metorial', detail: 'First-party integration.' }
  ],
  files: {
    'code/src/index.ts': ['let a = 1;', 'let b = 2;', 'let c = 3;'].join('\n'),
    'code/src/secrets.ts': "let key = 'AKIAABCDEFGHIJKLMNOP';",
    'auth.json': '[]'
  }
};

describe('resolveCitation', () => {
  it('copies the cited lines of source code', () => {
    expect(
      resolveCitation(
        { type: 'file', path: '/evidence/code/src/index.ts', lines: [2, 3] },
        sources
      )
    ).toMatchObject({ excerpt: 'let b = 2;\nlet c = 3;' });
  });

  it('never copies a secret into the report', () => {
    let ref = resolveCitation(
      { type: 'file', path: '/evidence/code/src/secrets.ts', lines: [1, 1] },
      sources
    );
    expect(ref).not.toHaveProperty('excerpt');
  });

  it('does not excerpt generated evidence files or missing lines', () => {
    expect(
      resolveCitation({ type: 'file', path: '/evidence/auth.json', lines: [1, 1] }, sources)
    ).not.toHaveProperty('excerpt');
    expect(
      resolveCitation({ type: 'file', path: '/evidence/code/src/index.ts' }, sources)
    ).not.toHaveProperty('excerpt');
  });

  it('replaces an excerpt written by the agent', () => {
    let ref = resolveCitation(
      { type: 'file', path: '/evidence/auth.json', lines: [1, 1], excerpt: 'forged' },
      sources
    );
    expect(ref).not.toHaveProperty('excerpt');
  });

  it('adds the title and detail of a fact from the evidence', () => {
    expect(
      resolveCitation({ type: 'fact', id: 'slate-origin', title: 'forged' }, sources)
    ).toEqual({
      type: 'fact',
      id: 'slate-origin',
      title: 'Built by Metorial',
      detail: 'First-party integration.'
    });
  });
});
