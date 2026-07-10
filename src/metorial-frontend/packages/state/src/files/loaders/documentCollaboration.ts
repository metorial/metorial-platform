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
        generation?: number;
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
        generation?: number;
      };
    }
  | {
      type: 'collaboration_reset';
      data: {
        document: Document;
        stateUpdate: string | null;
        generation: number;
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
        generation?: number;
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
        generation: number;
      };
    }
  | {
      type: 'yjs_state_initialize';
      data: {
        update: string;
        generation: number;
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
let reconnectBaseDelayMs = 1_000;
let reconnectMaxDelayMs = 10_000;

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
  editToken?: string | null;
}) => {
  let config = getConfig();
  let url = new URL(config.apiUrl);

  if (location.hostname === 'portals-us1.metorial-staging.com') {
    url.hostname = 'api-us1.metorial-staging.com';
  } else if (location.hostname === 'portals-us1.metorial.com') {
    url.hostname = 'api-us1.metorial.com';
  } else if (location.hostname === 'portals-eu1.metorial.com') {
    url.hostname = 'api-eu1.metorial.com';
  }

  let path = url.pathname.replace('/api', '');

  if (path.includes('/dashboard/us1')) {
    url.hostname = 'api-us1.metorial.com';
    path = path.replace('/dashboard/us1', '');
  } else if (path.includes('/dashboard/eu1')) {
    url.hostname = 'api-eu1.metorial.com';
    path = path.replace('/dashboard/eu1', '');
  }

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

  if (d.editToken) {
    url.searchParams.set('edit_token', d.editToken);
  }

  return url.toString();
};

let shouldSeedInitialBody = (d: { bodyStateReceived: boolean; initialMarkdown?: string }) =>
  !d.bodyStateReceived && (d.initialMarkdown?.trim().length ?? 0) > 0;

let resolveInitialMarkdown = (d: {
  document: Document;
  initialMarkdown?: string;
  getInitialMarkdown?: (document: Document) => string;
}) => d.getInitialMarkdown?.(d.document) ?? d.initialMarkdown;

let getReconnectDelayMs = (attempt: number) =>
  Math.min(reconnectBaseDelayMs * 2 ** Math.max(0, attempt), reconnectMaxDelayMs);

export let __documentCollaborationTestUtils = {
  encodeBase64,
  decodeBase64,
  getDocumentLiveUrl,
  shouldSeedInitialBody,
  resolveInitialMarkdown,
  getReconnectDelayMs
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
    editToken?: string | null;
    refreshEditToken?: () => Promise<string | null | undefined>;
    enabled?: boolean;
    initialMarkdown?: string;
    getInitialMarkdown?: (document: Document) => string;
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
  let [collaborationEpoch, setCollaborationEpoch] = useState(0);
  let wsRef = useRef<WebSocket | null>(null);
  let sessionIdRef = useRef<string | null>(null);
  let generationRef = useRef(0);
  let suppressLocalUpdateRef = useRef(false);
  let isReadyForEditorRef = useRef(false);
  let hasConnectedRef = useRef(false);
  let editTokenRef = useRef<string | null | undefined>(opts?.editToken);
  let refreshEditTokenRef = useRef(opts?.refreshEditToken);
  let destroyTimerRef = useRef<{
    ydoc: Y.Doc;
    awareness: Awareness;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  let ydoc = useMemo(() => new Y.Doc(), [instanceId, documentId, collaborationEpoch]);
  let awareness = useMemo(() => new Awareness(ydoc), [ydoc]);

  useEffect(() => {
    isReadyForEditorRef.current = isReadyForEditor;
  }, [isReadyForEditor]);

  useEffect(() => {
    editTokenRef.current = opts?.editToken;
  }, [opts?.editToken]);

  useEffect(() => {
    refreshEditTokenRef.current = opts?.refreshEditToken;
  }, [opts?.refreshEditToken]);

  useEffect(() => {
    hasConnectedRef.current = false;
  }, [ydoc]);

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
    if (!instanceId || !documentId) {
      setConnectionStatus('idle');
      setIsSynced(false);
      setIsReadyForEditor(false);
      setIsFallback(false);
      return;
    }

    if (!enabled) {
      setConnectionStatus('idle');
      setIsSynced(false);
      setIsReadyForEditor(true);
      setIsFallback(true);
      return;
    }

    let closed = false;
    let reconnectTimer: number | null = null;
    let reconnectAttempts = 0;
    let ws: WebSocket | null = null;
    let heartbeat: number | null = null;

    let handleDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === remoteOrigin) return;
      if (origin === seedOrigin) return;
      if (suppressLocalUpdateRef.current) return;

      sendJson(ws, {
        type: 'yjs_update',
        data: {
          update: encodeBase64(update),
          generation: generationRef.current
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

    let cleanupSocket = () => {
      if (heartbeat) {
        window.clearInterval(heartbeat);
        heartbeat = null;
      }
      if (wsRef.current === ws) wsRef.current = null;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
      ws = null;
    };

    let scheduleReconnect = () => {
      if (closed || reconnectTimer || !hasConnectedRef.current) return;
      let delay = getReconnectDelayMs(reconnectAttempts++);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect(true);
      }, delay);
    };

    let connect = async (isReconnect: boolean) => {
      if (closed) return;

      if (isReconnect && refreshEditTokenRef.current) {
        try {
          let refreshedEditToken = await refreshEditTokenRef.current();
          if (typeof refreshedEditToken == 'string') {
            editTokenRef.current = refreshedEditToken;
          } else if (refreshedEditToken === null) {
            editTokenRef.current = null;
          }
        } catch (err) {
          setError(err);
        }
        if (closed) return;
      }

      cleanupSocket();
      setConnectionStatus('connecting');
      setError(null);

      if (!hasConnectedRef.current) {
        setIsSynced(false);
        setIsReadyForEditor(false);
        setIsFallback(false);
        setInitialBodyStateReceived(false);
        setInitialBodySeeded(false);
      }

      let url = getDocumentLiveUrl({
        instanceId,
        documentId,
        organizationId: opts?.organizationId,
        editToken: editTokenRef.current
      });
      ws = new WebSocket(url);
      wsRef.current = ws;

      heartbeat = window.setInterval(() => {
        sendJson(ws, { type: 'ping' });
      }, heartbeatMs);

      ws.onopen = () => {
        if (closed) return;
        reconnectAttempts = 0;
        setConnectionStatus('connected');
        sendJson(ws, { type: 'ping' });
      };

      ws.onmessage = event => {
        if (closed || typeof event.data !== 'string') return;

        let message = JSON.parse(event.data) as CollaborationServerMessage;

        if (message.type === 'collaboration_snapshot') {
          sessionIdRef.current = message.data.sessionId;
          generationRef.current = message.data.generation ?? 0;
          setSnapshot(message.data.document);
          let bodyStateReceived = false;
          let initialMarkdown = resolveInitialMarkdown({
            document: message.data.document,
            initialMarkdown: opts?.initialMarkdown,
            getInitialMarkdown: opts?.getInitialMarkdown
          });

          if (message.data.stateUpdate) {
            Y.applyUpdate(ydoc, decodeBase64(message.data.stateUpdate), remoteOrigin);
            bodyStateReceived = ydoc.getXmlFragment('body').length > 0;
          }
          setInitialBodyStateReceived(bodyStateReceived);

          let seedUpdate: string | null = null;
          if (
            shouldSeedInitialBody({
              bodyStateReceived,
              initialMarkdown
            }) &&
            opts?.seedInitialBody
          ) {
            suppressLocalUpdateRef.current = true;
            try {
              seedUpdate = opts.seedInitialBody({
                initialMarkdown: initialMarkdown ?? '',
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
                update: seedUpdate!,
                generation: generationRef.current
              }
            });
          }

          for (let state of message.data.awareness ?? []) {
            applyAwarenessUpdate(awareness, decodeBase64(state.update), remoteOrigin);
          }

          if (!didSeedInitialBody) {
            hasConnectedRef.current = true;
            setIsFallback(false);
            setIsReadyForEditor(true);
            setIsSynced(true);
          }
          return;
        }

        if (message.type === 'yjs_state_initialized') {
          generationRef.current = message.data.generation ?? 0;
          Y.applyUpdate(ydoc, decodeBase64(message.data.update), remoteOrigin);
          hasConnectedRef.current = true;
          setIsFallback(false);
          setInitialBodyStateReceived(ydoc.getXmlFragment('body').length > 0);
          setIsReadyForEditor(true);
          setIsSynced(true);
          return;
        }

        if (message.type === 'yjs_update') {
          if (
            typeof message.data.generation === 'number' &&
            message.data.generation !== generationRef.current
          ) {
            return;
          }
          Y.applyUpdate(ydoc, decodeBase64(message.data.update), remoteOrigin);
          return;
        }

        if (message.type === 'collaboration_reset') {
          generationRef.current = message.data.generation;
          setSnapshot(message.data.document);
          setIsSynced(false);
          setIsReadyForEditor(false);
          cleanupSocket();
          setCollaborationEpoch(epoch => epoch + 1);
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

        if (
          message.type === 'document_snapshot' ||
          message.type === 'document_snapshot_saved'
        ) {
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
          return;
        }
      };

      ws.onclose = () => {
        if (closed) return;
        setConnectionStatus('idle');
        setIsSynced(false);
        if (!isReadyForEditorRef.current) {
          setIsFallback(true);
          setIsReadyForEditor(true);
          return;
        }
        scheduleReconnect();
      };
    };

    ydoc.on('update', handleDocUpdate);
    awareness.on('update', handleAwarenessUpdate);
    void connect(false);

    return () => {
      closed = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ydoc.off('update', handleDocUpdate);
      awareness.off('update', handleAwarenessUpdate);
      sessionIdRef.current = null;
      cleanupSocket();
    };
  }, [
    awareness,
    documentId,
    enabled,
    instanceId,
    opts?.getInitialMarkdown,
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
