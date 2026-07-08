export type DocumentLiveSessionState = {
  id: string;
  documentId: string;
  actorId: string;
  instanceId: string;
  lastPingAt: number;
  awarenessClientId?: number;
  awarenessUpdate?: string;
};

export let parseSessionState = (raw: string | undefined | null) => {
  if (!raw) return null;

  try {
    let parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.id != 'string' ||
      typeof parsed.documentId != 'string' ||
      typeof parsed.actorId != 'string' ||
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
