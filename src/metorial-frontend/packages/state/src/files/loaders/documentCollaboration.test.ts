import { describe, expect, it } from 'vitest';
import { __documentCollaborationTestUtils } from './documentCollaboration';

describe('document collaboration reset helpers', () => {
  it('seeds a reset collaboration state from the authoritative document snapshot', () => {
    let document = {
      id: 'doc_123',
      title: 'Skill',
      content: '# Skill\n\nMerged content.'
    } as any;

    expect(
      __documentCollaborationTestUtils.resolveInitialMarkdown({
        document,
        initialMarkdown: 'Stale editor content.',
        getInitialMarkdown: current => current.content.replace(/^# Skill\n\n/, '')
      })
    ).toBe('Merged content.');
  });
});
