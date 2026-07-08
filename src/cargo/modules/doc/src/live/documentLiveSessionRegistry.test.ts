import { describe, expect, it } from 'vitest';
import {
  type DocumentLiveSessionState,
  filterActiveSessions,
  parseSessionState
} from './documentLiveSessionRegistryUtils';

describe('document live session registry helpers', () => {
  let activeSession: DocumentLiveSessionState = {
    id: 'session-active',
    documentId: 'doc_123',
    actorId: 'actor_123',
    instanceId: 'cargo-a',
    lastPingAt: 10_000,
    awarenessClientId: 1,
    awarenessUpdate: 'AAAA'
  };

  let staleSession: DocumentLiveSessionState = {
    id: 'session-stale',
    documentId: 'doc_123',
    actorId: 'actor_456',
    instanceId: 'cargo-b',
    lastPingAt: 1_000
  };

  it('filters out sessions older than the timeout', () => {
    expect(
      filterActiveSessions({
        sessions: [activeSession, staleSession],
        now: 11_000,
        timeoutMs: 5_000
      })
    ).toEqual([activeSession]);
  });

  it('parses valid session state payloads', () => {
    expect(parseSessionState(JSON.stringify(activeSession))).toEqual(activeSession);
  });

  it('ignores invalid session state payloads', () => {
    expect(
      parseSessionState(JSON.stringify({ ...activeSession, actorId: undefined }))
    ).toBeNull();
    expect(parseSessionState('not-json')).toBeNull();
  });
});
