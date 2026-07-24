import { describe, expect, it } from 'vitest';
import {
  type DocumentLiveSessionState,
  filterActiveSessions,
  normalizeSessionState,
  parseSessionState
} from './documentLiveSessionRegistryUtils';

describe('document live session registry helpers', () => {
  let activeSession: DocumentLiveSessionState = {
    id: 'session-active',
    documentId: 'doc_123',
    actorId: 'actor_123',
    canWrite: true,
    instanceId: 'cargo-a',
    lastPingAt: 10_000,
    awarenessClientId: 1,
    awarenessUpdate: 'AAAA'
  };

  let staleSession: DocumentLiveSessionState = {
    id: 'session-stale',
    documentId: 'doc_123',
    actorId: 'actor_456',
    canWrite: false,
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

  it('omits bigint authorization context from persisted session state', () => {
    let liveSession = {
      ...activeSession,
      instanceId: undefined,
      accessTags: [101n],
      defaultPermissions: ['content_read']
    };
    let persisted = normalizeSessionState(liveSession, 'cargo-default');

    expect(persisted).toEqual({
      ...activeSession,
      instanceId: 'cargo-default'
    });
    expect(() => JSON.stringify(persisted)).not.toThrow();
  });

  it('ignores invalid session state payloads', () => {
    expect(
      parseSessionState(JSON.stringify({ ...activeSession, actorId: undefined }))
    ).toBeNull();
    expect(
      parseSessionState(JSON.stringify({ ...activeSession, canWrite: undefined }))
    ).toBeNull();
    expect(parseSessionState('not-json')).toBeNull();
  });
});
