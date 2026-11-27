import { describe, expect, it } from 'vitest';
import { presentEvidence } from './securityReview';

describe('presentEvidence', () => {
  it('names generated evidence files after what they contain', () => {
    expect(
      presentEvidence([
        { type: 'file', path: '/evidence/auth.json' },
        { type: 'file', path: '/evidence/docs/overview.md' }
      ])
    ).toEqual([
      { type: 'note', label: 'Authentication methods', detail: null },
      { type: 'note', label: 'Documentation: overview.md', detail: null }
    ]);
  });

  it('hides internal evidence files', () => {
    expect(
      presentEvidence([
        { type: 'file', path: '/evidence/facts.json' },
        { type: 'file', path: '/evidence/README.md' },
        { type: 'fact', id: 'unresolved' }
      ])
    ).toEqual([]);
  });

  it('presents source code relative to the reviewed code with its excerpt', () => {
    expect(
      presentEvidence([
        { type: 'file', path: '/evidence/code/src/index.ts', lines: [1, 2], excerpt: 'let a;' }
      ])
    ).toEqual([{ type: 'file', path: 'src/index.ts', lines: [1, 2], excerpt: 'let a;' }]);
  });

  it('presents resolved facts as notes and removes duplicates', () => {
    expect(
      presentEvidence([
        { type: 'fact', id: 'a', title: 'Built by Metorial', detail: 'First party.' },
        { type: 'file', path: '/evidence/auth.json' },
        { type: 'file', path: '/evidence/auth.json' }
      ])
    ).toEqual([
      { type: 'note', label: 'Built by Metorial', detail: 'First party.' },
      { type: 'note', label: 'Authentication methods', detail: null }
    ]);
  });
});
