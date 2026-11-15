import { describe, expect, it } from 'vitest';
import {
  canSendDocumentLiveMessage,
  hasSameDocumentLiveIdentity,
  isDocumentLiveTokenExpired
} from './documentLiveAccess';

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
    expect(
      canSendDocumentLiveMessage({ canWrite: false, type: 'document_token_update' })
    ).toBe(true);
  });

  it('allows mutations for writable sessions', () => {
    expect(canSendDocumentLiveMessage({ canWrite: true, type: 'yjs_update' })).toBe(true);
    expect(
      canSendDocumentLiveMessage({ canWrite: true, type: 'document_snapshot_save' })
    ).toBe(true);
  });
});

describe('document live token replacement', () => {
  let identity = {
    documentId: 'doc_123',
    instanceId: 'inst_123',
    organizationId: 'org_123',
    actorId: 'rac_123'
  };

  it('accepts only replacement tokens for the same actor and resource', () => {
    expect(hasSameDocumentLiveIdentity(identity, { ...identity })).toBe(true);
    expect(hasSameDocumentLiveIdentity(identity, { ...identity, actorId: 'rac_other' })).toBe(
      false
    );
    expect(
      hasSameDocumentLiveIdentity(identity, { ...identity, documentId: 'doc_other' })
    ).toBe(false);
  });

  it('treats the exact expiry instant as expired', () => {
    expect(isDocumentLiveTokenExpired(1_000, 999)).toBe(false);
    expect(isDocumentLiveTokenExpired(1_000, 1_000)).toBe(true);
  });
});
