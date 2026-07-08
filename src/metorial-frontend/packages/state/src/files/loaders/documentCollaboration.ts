import { getConfig } from '@metorial/frontend-config';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates
} from 'y-protocols/awareness';
import * as Y from 'yjs';
import type { Document, DocumentParticipant } from './documents';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';
type SnapshotSaveStatus = 'saved' | 'pending' | 'saving' | 'error';

type CollaborationServerMessage =
  | {
      type: 'collaboration_snapshot';
      data: {
        sessionId: string;
        document: Document;
        stateUpdate?: string | null;
        awareness?: {
          sessionId: string;
          actorId: string;
          clientId: number;
          update: string;
        }[];
      };
    }
  | {
      type: 'yjs_update';
      data: {
        sessionId: string;
        actorId: string;
        update: string;
      };
    }
  | {
      type: 'awareness_update';
      data: {
        sessionId: string;
        actorId: string;
        clientId: number;
        update: string;
      };
    }
  | {
      type: 'awareness_remove';
      data: {
        sessionId: string;
        actorId: string;
        clientId: number;
      };
    }
  | {
      type: 'yjs_state_initialized';
      data: {
        initialized: boolean;
        update: string;
      };
    }
  | {
      type: 'document_snapshot';
      data: Document;
    }
  | {
      type: 'document_snapshot_saved';
      data: Document;
    }
  | {
      type: 'participant_list';
      data: DocumentParticipant[];
    }
  | {
      type: 'pong';
      data: {
        documentId: string;
      };
    }
  | {
      type: 'error';
      data: unknown;
    };

type CollaborationClientMessage =
  | {
      type: 'ping';
    }
  | {
      type: 'yjs_update';
      data: {
        update: string;
      };
    }
  | {
      type: 'yjs_state_initialize';
      data: {
        update: string;
      };
    }
  | {
      type: 'awareness_update';
      data: {
        clientId: number;
        update: string;
      };
    }
  | {
      type: 'document_snapshot_save';
      data: {
        title: string;
        content: string;
      };
    };

let remoteOrigin = { source: 'document-collaboration-remote' };
let seedOrigin = { source: 'document-collaboration-seed' };
let heartbeatMs = 30 * 1000;

let encodeBase64 = (update: Uint8Array) => {
  let binary = '';
  let chunkSize = 0x8000;

  for (let i = 0; i < update.length; i += chunkSize) {
    binary += String.fromCharCode(...update.subarray(i, i + chunkSize));
  }

  return btoa(binary);
};

let decodeBase64 = (update: string) => {
  let binary = atob(update);
  let bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

let getDocumentLiveUrl = (d: {
  instanceId: string;
  documentId: string;
  organizationId?: string | null;
}) => {
  let config = getConfig();
  let url = new URL(config.apiUrl);

  let path = url.pathname;
  while (path.endsWith('/')) path = path.slice(0, -1);
  path += '/documents-live';

  url.pathname = path;
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('documentId', d.documentId);
  url.searchParams.set('instanceId', d.instanceId);
  url.searchParams.set('protocol', 'yjs');

  if (d.organizationId) {
    url.searchParams.set('organizationId', d.organizationId);
  }

  return url.toString();
};

let shouldSeedInitialBody = (d: { bodyStateReceived: boolean; initialMarkdown?: string }) =>
  !d.bodyStateReceived && (d.initialMarkdown?.trim().length ?? 0) > 0;

export let __documentCollaborationTestUtils = {
  encodeBase64,
  decodeBase64,
  getDocumentLiveUrl,
  shouldSeedInitialBody
};

let sendJson = (ws: WebSocket | null, message: CollaborationClientMessage) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(message));
  return true;
};

export let useDocumentCollaboration = (
  instanceId: string | null | undefined,
  documentId: string | null | undefined,
  opts?: {
    organizationId?: string | null;
    enabled?: boolean;
    initialMarkdown?: string;
    seedInitialBody?: (d: { initialMarkdown: string; origin: unknown }) => string | null;
  }
) => {
  let enabled = opts?.enabled ?? true;
  let [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  let [snapshotSaveStatus, setSnapshotSaveStatus] = useState<SnapshotSaveStatus>('saved');
  let [snapshot, setSnapshot] = useState<Document | null>(null);
  let [participants, setParticipants] = useState<DocumentParticipant[]>([]);
  let [error, setError] = useState<unknown>(null);
  let [isSynced, setIsSynced] = useState(false);
  let [isReadyForEditor, setIsReadyForEditor] = useState(false);
  let [isFallback, setIsFallback] = useState(false);
  let [initialBodyStateReceived, setInitialBodyStateReceived] = useState(false);
  let [initialBodySeeded, setInitialBodySeeded] = useState(false);
  let wsRef = useRef<WebSocket | null>(null);
  let sessionIdRef = useRef<string | null>(null);
  let suppressLocalUpdateRef = useRef(false);
  let isReadyForEditorRef = useRef(false);
  let destroyTimerRef = useRef<{
    ydoc: Y.Doc;
    awareness: Awareness;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  let ydoc = useMemo(() => new Y.Doc(), [instanceId, documentId]);
  let awareness = useMemo(() => new Awareness(ydoc), [ydoc]);

  useEffect(() => {
    isReadyForEditorRef.current = isReadyForEditor;
  }, [isReadyForEditor]);

  useEffect(() => {
    if (destroyTimerRef.current?.ydoc === ydoc) {
      clearTimeout(destroyTimerRef.current.timer);
      destroyTimerRef.current = null;
    }

    return () => {
      let pending = {
        ydoc,
        awareness,
        timer: setTimeout(() => {
          awareness.destroy();
          ydoc.destroy();
          if (destroyTimerRef.current?.ydoc === ydoc) {
            destroyTimerRef.current = null;
          }
        }, 0)
      };
      destroyTimerRef.current = pending;
    };
  }, [awareness, ydoc]);

  useEffect(() => {
    if (!enabled || !instanceId || !documentId) {
      setConnectionStatus('idle');
      setIsSynced(false);
      setIsReadyForEditor(false);
      setIsFallback(false);
      return;
    }

    let closed = false;
    let url = getDocumentLiveUrl({
      instanceId,
      documentId,
      organizationId: opts?.organizationId
    });
    let ws = new WebSocket(url);
    wsRef.current = ws;
    setConnectionStatus('connecting');
    setError(null);
    setIsSynced(false);
    setIsReadyForEditor(false);
    setIsFallback(false);
    setInitialBodyStateReceived(false);
    setInitialBodySeeded(false);

    let handleDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === remoteOrigin) return;
      if (origin === seedOrigin) return;
      if (suppressLocalUpdateRef.current) return;

      sendJson(ws, {
        type: 'yjs_update',
        data: {
          update: encodeBase64(update)
        }
      });
    };

    let handleAwarenessUpdate = (
      change: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      if (origin === remoteOrigin) return;

      let changedClients = [...change.added, ...change.updated, ...change.removed];
      if (changedClients.length === 0) return;

      sendJson(ws, {
        type: 'awareness_update',
        data: {
          clientId: awareness.clientID,
          update: encodeBase64(encodeAwarenessUpdate(awareness, changedClients))
        }
      });
    };

    ydoc.on('update', handleDocUpdate);
    awareness.on('update', handleAwarenessUpdate);

    let heartbeat = window.setInterval(() => {
      sendJson(ws, { type: 'ping' });
    }, heartbeatMs);

    ws.onopen = () => {
      if (closed) return;
      setConnectionStatus('connected');
      sendJson(ws, { type: 'ping' });
    };

    ws.onmessage = event => {
      if (closed || typeof event.data !== 'string') return;

      let message = JSON.parse(event.data) as CollaborationServerMessage;

      if (message.type === 'collaboration_snapshot') {
        sessionIdRef.current = message.data.sessionId;
        setSnapshot(message.data.document);
        let bodyStateReceived = false;

        if (message.data.stateUpdate) {
          Y.applyUpdate(ydoc, decodeBase64(message.data.stateUpdate), remoteOrigin);
          bodyStateReceived = ydoc.getXmlFragment('body').length > 0;
        }
        setInitialBodyStateReceived(bodyStateReceived);

        let seedUpdate: string | null = null;
        if (
          shouldSeedInitialBody({
            bodyStateReceived,
            initialMarkdown: opts?.initialMarkdown
          }) &&
          opts?.seedInitialBody
        ) {
          suppressLocalUpdateRef.current = true;
          try {
            seedUpdate = opts.seedInitialBody({
              initialMarkdown: opts.initialMarkdown ?? '',
              origin: seedOrigin
            });
          } finally {
            suppressLocalUpdateRef.current = false;
          }
        }
        let didSeedInitialBody = !!seedUpdate;
        setInitialBodySeeded(didSeedInitialBody);

        if (didSeedInitialBody) {
          sendJson(ws, {
            type: 'yjs_state_initialize',
            data: {
              update: seedUpdate!
            }
          });
        }

        for (let state of message.data.awareness ?? []) {
          applyAwarenessUpdate(awareness, decodeBase64(state.update), remoteOrigin);
        }

        if (!didSeedInitialBody) {
          setIsReadyForEditor(true);
          setIsSynced(true);
        }
        return;
      }

      if (message.type === 'yjs_state_initialized') {
        Y.applyUpdate(ydoc, decodeBase64(message.data.update), remoteOrigin);
        setInitialBodyStateReceived(ydoc.getXmlFragment('body').length > 0);
        setIsReadyForEditor(true);
        setIsSynced(true);
        return;
      }

      if (message.type === 'yjs_update') {
        Y.applyUpdate(ydoc, decodeBase64(message.data.update), remoteOrigin);
        return;
      }

      if (message.type === 'awareness_update') {
        applyAwarenessUpdate(awareness, decodeBase64(message.data.update), remoteOrigin);
        return;
      }

      if (message.type === 'awareness_remove') {
        removeAwarenessStates(awareness, [message.data.clientId], remoteOrigin);
        return;
      }

      if (message.type === 'document_snapshot' || message.type === 'document_snapshot_saved') {
        setSnapshot(message.data);
        if (message.type === 'document_snapshot_saved') {
          setSnapshotSaveStatus('saved');
        }
        return;
      }

      if (message.type === 'participant_list') {
        setParticipants(message.data);
        return;
      }

      if (message.type === 'error') {
        setError(message.data);
        setSnapshotSaveStatus('error');
      }
    };

    ws.onerror = event => {
      if (closed) return;
      setError(event);
      setConnectionStatus('error');
      if (!isReadyForEditorRef.current) {
        setIsFallback(true);
        setIsReadyForEditor(true);
      }
    };

    ws.onclose = () => {
      if (closed) return;
      setConnectionStatus('idle');
      setIsSynced(false);
      if (!isReadyForEditorRef.current) {
        setIsFallback(true);
        setIsReadyForEditor(true);
      }
    };

    return () => {
      closed = true;
      window.clearInterval(heartbeat);
      ydoc.off('update', handleDocUpdate);
      awareness.off('update', handleAwarenessUpdate);
      sessionIdRef.current = null;
      if (wsRef.current === ws) wsRef.current = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [
    awareness,
    documentId,
    enabled,
    instanceId,
    opts?.initialMarkdown,
    opts?.organizationId,
    opts?.seedInitialBody,
    ydoc
  ]);

  let saveSnapshot = useCallback((input: { title: string; content: string }) => {
    setSnapshotSaveStatus('saving');

    let sent = sendJson(wsRef.current, {
      type: 'document_snapshot_save',
      data: input
    });

    if (!sent) {
      setSnapshotSaveStatus('error');
    }
  }, []);

  let markSnapshotPending = useCallback(() => {
    setSnapshotSaveStatus(current => (current === 'saving' ? current : 'pending'));
  }, []);

  return {
    ydoc,
    awareness,
    provider: {
      awareness
    },
    connectionStatus,
    snapshotSaveStatus,
    snapshot,
    participants,
    error,
    isSynced,
    isReadyForEditor,
    isFallback,
    initialBodyStateReceived,
    initialBodySeeded,
    sessionId: sessionIdRef.current,
    saveSnapshot,
    markSnapshotPending
  };
};
