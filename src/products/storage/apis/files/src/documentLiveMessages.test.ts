import { describe, expect, it } from 'vitest';
import { isDocumentLiveMutation } from './documentLiveMessages';

describe('document live message access', () => {
  it.each([
    'yjs_update',
    'yjs_state_initialize',
    'document_update',
    'document_title_update',
    'document_snapshot_save'
  ])('classifies %s as a mutation', type => {
    expect(isDocumentLiveMutation(JSON.stringify({ type, data: {} }))).toBe(true);
  });

  it.each(['ping', 'awareness_update'])('allows non-mutating %s messages', type => {
    expect(isDocumentLiveMutation(JSON.stringify({ type, data: {} }))).toBe(false);
  });

  it('does not treat malformed messages as mutations', () => {
    expect(isDocumentLiveMutation('not-json')).toBe(false);
  });
});
