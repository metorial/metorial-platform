import { internalServerError, isServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { generatePlainId } from '@lowerdeck/id';
import { upgradeWebSocket, websocket } from 'hono/bun';
import type { WSContext } from 'hono/ws';
import { db } from '../db';
import { documentParticipantPresenter, documentPresenter } from '../presenters';
import { documentService } from '../services';

export { websocket };

let participantTimeoutMs = 60 * 1000;
let participantCleanupIntervalMs = 10 * 1000;

type DocumentLiveClientMessage =
  | {
      type: 'ping';
    }
  | {
      type: 'document_update';
      data: {
        content: string;
        title?: string;
      };
    }
  | {
      type: 'document_title_update';
      data: {
        title: string;
      };
    };

type LiveSession = {
  id: string;
  documentId: string;
  actorId: string;
  lastPingAt: number;
};

let liveSessions = new Map<string, LiveSession>();
let socketsBySessionId = new Map<string, WSContext<any>>();
let sessionIdsByDocumentId = new Map<string, Set<string>>();
let lastParticipantPayloadByDocumentId = new Map<string, string>();

let getRoomSessionIds = (documentId: string) => {
  let existing = sessionIdsByDocumentId.get(documentId);
  if (existing) return existing;

  let created = new Set<string>();
  sessionIdsByDocumentId.set(documentId, created);
  return created;
};

let getActiveSessionIds = (documentId: string) => {
  let now = Date.now();
  let sessionIds = sessionIdsByDocumentId.get(documentId);
  if (!sessionIds) return [];

  return [...sessionIds].filter(sessionId => {
    let session = liveSessions.get(sessionId);
    return !!session && now - session.lastPingAt <= participantTimeoutMs;
  });
};

let getActiveActorIds = (documentId: string) =>
  [
    ...new Set(
      getActiveSessionIds(documentId).map(sessionId => liveSessions.get(sessionId)?.actorId)
    )
  ].filter((actorId): actorId is string => !!actorId);

let send = (ws: WSContext<any>, type: string, data: any) => {
  ws.send(JSON.stringify({ type, data }));
};

let sendError = (ws: WSContext<any>, error: unknown) => {
  if (isServiceError(error)) {
    send(ws, 'error', error.toResponse());
    return;
  }

  send(ws, 'error', internalServerError().toResponse());
};

let broadcastToDocument = (documentId: string, type: string, data: any) => {
  for (let sessionId of getActiveSessionIds(documentId)) {
    let ws = socketsBySessionId.get(sessionId);
    if (!ws) continue;
    send(ws, type, data);
  }
};

let buildDocumentPayload = (
  document: Awaited<ReturnType<typeof documentService.getScopedDocumentById>>['document'],
  d?: {
    content?: string;
    updatedAt?: Date;
  }
) => {
  let payload = documentPresenter(document);

  return {
    ...payload,
    ...(d?.content !== undefined ? { content: d.content } : {}),
    ...(d?.updatedAt
      ? {
          updatedAt: d.updatedAt,
          file: {
            ...payload.file,
            updatedAt: d.updatedAt
          }
        }
      : {})
  };
};

let broadcastParticipantList = async (documentId: string) => {
  let actorIds = getActiveActorIds(documentId);
  let payload =
    actorIds.length === 0
      ? []
      : (
          await db.documentParticipant.findMany({
            where: {
              document: {
                id: documentId
              },
              tenantActor: {
                id: {
                  in: actorIds
                }
              }
            },
            include: {
              document: true,
              tenantActor: true
            },
            orderBy: [
              {
                role: 'asc'
              },
              {
                createdAt: 'asc'
              }
            ]
          })
        )
          .map(documentParticipantPresenter)
          .sort(
            (left, right) =>
              left.actor.name.localeCompare(right.actor.name) ||
              left.id.localeCompare(right.id)
          );

  let serialized = JSON.stringify(payload);
  if (lastParticipantPayloadByDocumentId.get(documentId) === serialized) {
    return;
  }

  lastParticipantPayloadByDocumentId.set(documentId, serialized);
  broadcastToDocument(documentId, 'participant_list', payload);
};

let removeSession = async (sessionId: string) => {
  let session = liveSessions.get(sessionId);
  if (!session) return;

  liveSessions.delete(sessionId);
  socketsBySessionId.delete(sessionId);

  let room = sessionIdsByDocumentId.get(session.documentId);
  if (room) {
    room.delete(sessionId);
    if (room.size === 0) {
      sessionIdsByDocumentId.delete(session.documentId);
      lastParticipantPayloadByDocumentId.delete(session.documentId);
    }
  }

  await broadcastParticipantList(session.documentId);
};

let cleanupExpiredSessions = async () => {
  let now = Date.now();
  let expired = [...liveSessions.values()].filter(
    session => now - session.lastPingAt > participantTimeoutMs
  );

  for (let session of expired) {
    let ws = socketsBySessionId.get(session.id);
    if (ws) {
      try {
        ws.close(4001, 'heartbeat_timeout');
      } catch {}
    }

    await removeSession(session.id);
  }
};

let cleanupTimer = setInterval(() => {
  cleanupExpiredSessions().catch(error => {
    console.error('Failed to cleanup expired live document sessions', error);
  });
}, participantCleanupIntervalMs);
cleanupTimer.unref?.();

export let documentLiveApi = createHono()
  .get('/ping', c => c.text('OK'))
  .get(
    '/document-live',
    upgradeWebSocket(async c => {
      let url = new URL(c.req.url);
      let documentId = url.searchParams.get('documentId');
      let actorId = url.searchParams.get('actorId');

      if (!documentId || !actorId) {
        throw new Error('documentId and actorId query params are required');
      }

      let scopedDocument = await documentService.getScopedDocumentById({
        documentId
      });

      await documentService.getDocumentById({
        tenant: scopedDocument.tenant,
        environment: scopedDocument.environment,
        documentId,
        actorId
      });

      let sessionId = generatePlainId(20);

      return {
        onOpen: async (_, ws) => {
          liveSessions.set(sessionId, {
            id: sessionId,
            documentId,
            actorId,
            lastPingAt: Date.now()
          });
          socketsBySessionId.set(sessionId, ws);
          getRoomSessionIds(documentId).add(sessionId);

          send(ws, 'document_snapshot', buildDocumentPayload(scopedDocument.document));
          await broadcastParticipantList(documentId);
        },

        onMessage: async event => {
          let session = liveSessions.get(sessionId);
          if (!session) return;

          session.lastPingAt = Date.now();

          try {
            let parsed = JSON.parse(event.data.toString()) as DocumentLiveClientMessage;

            if (parsed.type === 'ping') {
              let ws = socketsBySessionId.get(sessionId);
              if (ws) {
                send(ws, 'pong', {
                  documentId: session.documentId
                });
              }
              return;
            }

            if (parsed.type !== 'document_update' && parsed.type !== 'document_title_update') {
              throw new Error('Invalid live document payload');
            }

            if (
              parsed.type === 'document_update' &&
              typeof parsed.data?.content !== 'string'
            ) {
              throw new Error('Invalid live document payload');
            }

            if (
              parsed.type === 'document_title_update' &&
              typeof parsed.data?.title !== 'string'
            ) {
              throw new Error('Invalid live document payload');
            }

            let currentScopedDocument = await documentService.getScopedDocumentById({
              documentId: session.documentId
            });

            await documentService.getDocumentById({
              tenant: currentScopedDocument.tenant,
              environment: currentScopedDocument.environment,
              documentId: session.documentId,
              actorId: session.actorId
            });

            let updatedDocument = await documentService.updateDocument({
              tenant: currentScopedDocument.tenant,
              environment: currentScopedDocument.environment,
              document: currentScopedDocument.document,
              input: {
                actorId: session.actorId,
                title: parsed.data.title,
                content: parsed.type === 'document_update' ? parsed.data.content : undefined
              }
            });

            broadcastToDocument(
              updatedDocument.id,
              'document_snapshot',
              buildDocumentPayload(updatedDocument)
            );

            let childDocuments = await documentService.listLinkedChildDocumentsForLiveSync({
              parentDocumentId: updatedDocument.id
            });
            let sharedContent =
              updatedDocument.resolvedContent ?? updatedDocument.content.content;
            let sharedUpdatedAt = updatedDocument.draftUpdatedAt ?? updatedDocument.updatedAt;

            for (let childDocument of childDocuments) {
              broadcastToDocument(
                childDocument.id,
                'document_snapshot',
                buildDocumentPayload(childDocument, {
                  content: sharedContent,
                  updatedAt: sharedUpdatedAt
                })
              );
            }

            await broadcastParticipantList(updatedDocument.id);
          } catch (error) {
            let ws = socketsBySessionId.get(sessionId);
            if (ws) {
              sendError(ws, error);
            }
          }
        },

        onClose: async () => {
          await removeSession(sessionId);
        },

        onError: async error => {
          console.error('Cargo live document websocket error', error);
          await removeSession(sessionId);
        }
      };
    })
  );
