export type DocumentLiveSessionState = {
  id: string;
  documentId: string;
  actorId: string;
  canWrite: boolean;
  instanceId: string;
  lastPingAt: number;
  awarenessClientId?: number;
  awarenessUpdate?: string;
};

export let normalizeSessionState = (
  session: Omit<DocumentLiveSessionState, 'instanceId'> & { instanceId?: string },
  defaultInstanceId: string
): DocumentLiveSessionState => ({
  id: session.id,
  documentId: session.documentId,
  actorId: session.actorId,
  canWrite: session.canWrite,
  instanceId: session.instanceId ?? defaultInstanceId,
  lastPingAt: session.lastPingAt,
  awarenessClientId: session.awarenessClientId,
  awarenessUpdate: session.awarenessUpdate
});

export let parseSessionState = (raw: string | undefined | null) => {
  if (!raw) return null;

  try {
    let parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.id != 'string' ||
      typeof parsed.documentId != 'string' ||
      typeof parsed.actorId != 'string' ||
      typeof parsed.canWrite != 'boolean' ||
      typeof parsed.instanceId != 'string' ||
      typeof parsed.lastPingAt != 'number'
    ) {
      return null;
    }

    return parsed as DocumentLiveSessionState;
  } catch {
    return null;
  }
};

export let filterActiveSessions = (d: {
  sessions: DocumentLiveSessionState[];
  now: number;
  timeoutMs: number;
}) => d.sessions.filter(session => d.now - session.lastPingAt <= d.timeoutMs);
