import { describe, expect, it } from 'vitest';
import { canSendDocumentLiveMessage } from './documentLiveAccess';

describe('document live session access', () => {
  it.each([
    'yjs_update',
    'yjs_state_initialize',
    'document_update',
    'document_title_update',
    'document_snapshot_save'
  ])('rejects %s for read-only sessions', type => {
    expect(canSendDocumentLiveMessage({ canWrite: false, type })).toBe(false);
  });

  it('allows presence and heartbeat messages for read-only sessions', () => {
    expect(canSendDocumentLiveMessage({ canWrite: false, type: 'ping' })).toBe(true);
    expect(canSendDocumentLiveMessage({ canWrite: false, type: 'awareness_update' })).toBe(
      true
    );
  });

  it('allows mutations for writable sessions', () => {
    expect(canSendDocumentLiveMessage({ canWrite: true, type: 'yjs_update' })).toBe(true);
    expect(
      canSendDocumentLiveMessage({ canWrite: true, type: 'document_snapshot_save' })
    ).toBe(true);
  });
});
