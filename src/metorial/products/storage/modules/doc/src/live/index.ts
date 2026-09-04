import {
  forbiddenError,
  internalServerError,
  isServiceError,
  ServiceError
} from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { generatePlainId } from '@lowerdeck/id';
import type { Context } from '@metorial/context';
import { db, type StoreParticipantPermissions } from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import { upgradeWebSocket, websocket } from 'hono/bun';
import type { WSContext } from 'hono/ws';
import { internalDocumentCollaborationService } from '../internal/documentCollaboration';
import { internalDocumentSyncService } from '../internal/documentSync';
import { queueDocumentCollaborationFlush } from '../queues/documentCollaborationFlush';
import { documentService } from '../services/document';
import {
  canSendDocumentLiveMessage,
  hasSameDocumentLiveIdentity,
  isDocumentLiveTokenExpired
} from './documentLiveAccess';
import { publishDocumentLiveBusMessage, subscribeToDocumentLiveBus } from './documentLiveBus';
import { type DocumentLiveBusMessageType } from './documentLiveBusProtocol';
import {
  listActiveLiveSessions,
  removeLiveSession,
  shouldPublishParticipantPayload,
  upsertLiveSession
} from './documentLiveSessionRegistry';

export { websocket };

let participantTimeoutMs = 60 * 1000;
let participantCleanupIntervalMs = 10 * 1000;

type DocumentLiveClientMessage =
  | {
      type: 'ping';
    }
  | {
      type: 'document_token_update';
      data: {
        token: string;
        requestId: string;
      };
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
    }
  | {
      type: 'yjs_update';
      data: {
        update: string;
        generation?: number;
      };
    }
  | {
      type: 'yjs_state_initialize';
      data: {
        update: string;
        generation?: number;
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

type LiveSession = {
  id: string;
  documentId: string;
  actorId: string;
  /** Captured when the socket connects, so edits made over it can be attributed. */
  context: Context;
  instanceId: string;
  organizationId: string;
  authorization: ResourceAuthorization;
  permissions: ('content_read' | 'content_write')[];
  canWrite: boolean;
  expiresAt: number;
  defaultPermissions?: StoreParticipantPermissions[];
  overridePermissions?: boolean;
  lastPingAt: number;
  awarenessClientId?: number;
  awarenessUpdate?: string;
  expiryTimer?: ReturnType<typeof setTimeout>;
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

let getActiveActorIds = async (documentId: string) =>
  [
    ...new Set(
      (await listActiveLiveSessions(documentId, participantTimeoutMs)).map(
        session => session.actorId
      )
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

let broadcastToDocumentExcept = (
  documentId: string,
  excludedSessionId: string,
  type: string,
  data: any
) => {
  for (let sessionId of getActiveSessionIds(documentId)) {
    if (sessionId === excludedSessionId) continue;

    let ws = socketsBySessionId.get(sessionId);
    if (!ws) continue;
    send(ws, type, data);
  }
};

let broadcastDistributedToDocument = async (
  documentId: string,
  type: DocumentLiveBusMessageType,
  data: any,
  originSessionId?: string
) => {
  broadcastToDocument(documentId, type, data);
  await publishDocumentLiveBusMessage({
    originSessionId,
    documentId,
    type,
    data
  });
};

let broadcastDistributedToDocumentExcept = async (
  documentId: string,
  excludedSessionId: string,
  type: DocumentLiveBusMessageType,
  data: any
) => {
  broadcastToDocumentExcept(documentId, excludedSessionId, type, data);
  await publishDocumentLiveBusMessage({
    originSessionId: excludedSessionId,
    documentId,
    type,
    data
  });
};

let handleLiveBusMessage = async (message: {
  documentId: string;
  type: DocumentLiveBusMessageType;
  data: any;
}) => {
  if (message.type === 'collaboration_reset') {
    broadcastToDocument(
      message.documentId,
      message.type,
      await buildCollaborationResetPayload(message.documentId, {
        stateUpdate: message.data.stateUpdate ?? null,
        generation: message.data.generation
      })
    );
    return;
  }

  broadcastToDocument(message.documentId, message.type, message.data);
};

let subscribeToLiveBus = () => {
  subscribeToDocumentLiveBus(handleLiveBusMessage).catch(error => {
    console.error('Failed to subscribe to Cargo live document events', error);
    let retryTimer = setTimeout(subscribeToLiveBus, 5000);
    retryTimer.unref?.();
  });
};

subscribeToLiveBus();

let persistLiveSession = async (session: LiveSession) => {
  await upsertLiveSession(session, participantTimeoutMs);
};

let getAwarenessPayload = async (documentId: string) =>
  (await listActiveLiveSessions(documentId, participantTimeoutMs))
    .map(session => {
      if (
        !session ||
        typeof session.awarenessClientId != 'number' ||
        !session.awarenessUpdate
      ) {
        return null;
      }

      return {
        sessionId: session.id,
        actorId: session.actorId,
        clientId: session.awarenessClientId,
        update: session.awarenessUpdate
      };
    })
    .filter((state): state is NonNullable<typeof state> => !!state);

let presentActor = (actor: any) => ({
  object: 'cargo#actor',
  id: actor.id,
  identifier: actor.identifier,
  type: actor.type,
  name: actor.name,
  createdAt: actor.createdAt
});

let presentFilePurpose = (purpose: any) => ({
  object: 'cargo#filePurpose',
  id: purpose.id,
  slug: purpose.slug,
  name: purpose.name,
  ownerType: purpose.ownerType,
  canHaveLinks: purpose.canHaveLinks,
  createdAt: purpose.createdAt
});

let presentFile = (
  file: any,
  opts?: { resolvedTitle?: string; resolvedUpdatedAt?: Date }
) => ({
  object: 'cargo#file',
  id: file.id,
  type: file.document ? 'document' : 'file',
  status: file.status,
  documentId: file.document?.id,
  storeId: file.effectiveStoreId ?? file.storeId,
  fileName: file.fileName,
  fileSize: file.fileSize,
  fileType: file.fileType,
  title: opts?.resolvedTitle ?? file.title ?? file.fileName,
  isReadOnly: file.isReadOnly,
  isTemplateBacking: file.isTemplateBacking,
  purpose: presentFilePurpose(file.purpose),
  createdBy: file.createdByResourceActor ? presentActor(file.createdByResourceActor) : null,
  signedDownloadUrl: undefined,
  createdAt: file.createdAt,
  updatedAt: opts?.resolvedUpdatedAt ?? file.updatedAt
});

let presentDocument = (document: any) => {
  let updatedAt = document.draftUpdatedAt
    ? new Date(Math.max(document.updatedAt.getTime(), document.draftUpdatedAt.getTime()))
    : document.updatedAt;

  return {
    object: 'cargo#document',
    id: document.id,
    title: document.resolvedTitle ?? document.title,
    status: document.file.status,
    fileId: document.file.id,
    file: presentFile(
      {
        ...document.file,
        document: {
          id: document.id
        }
      },
      {
        resolvedTitle: document.resolvedTitle ?? document.title,
        resolvedUpdatedAt: updatedAt
      }
    ),
    parentDocumentId: document.parentDocument?.id,
    currentVersionId: document.currentVersion?.id,
    content: document.resolvedContent ?? document.content.content,
    isReadOnly: document.isReadOnly,
    isTemplateBacking: document.isTemplateBacking,
    createdBy: document.createdByResourceActor
      ? presentActor(document.createdByResourceActor)
      : null,
    createdAt: document.createdAt,
    updatedAt
  };
};

let presentDocumentParticipant = (participant: any) => ({
  object: 'cargo#documentParticipant',
  id: participant.id,
  documentId: participant.document.id,
  role: participant.role,
  editCount: participant.editCount,
  lastEditedAt: participant.lastEditedAt,
  lastViewedAt: participant.lastViewedAt,
  actor: presentActor(participant.resourceActor),
  createdAt: participant.createdAt
});

let buildDocumentPayload = (
  document: Awaited<ReturnType<typeof documentService.getScopedDocumentById>>['document'],
  d?: {
    content?: string;
    updatedAt?: Date;
  }
) => {
  let payload = presentDocument(document);

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

let buildCollaborationResetPayload = async (
  documentId: string,
  state?: {
    stateUpdate: string | null;
    generation: number;
  }
) => {
  let [scopedDocument, collaboration] = await Promise.all([
    documentService.getScopedDocumentById({ documentId }),
    state
      ? Promise.resolve({
          update: state.stateUpdate,
          generation: state.generation
        })
      : internalDocumentCollaborationService.getSnapshot(documentId)
  ]);

  return {
    document: buildDocumentPayload(scopedDocument.document),
    stateUpdate: collaboration.update,
    generation: collaboration.generation
  };
};

let sendCollaborationReset = async (ws: WSContext<any>, documentId: string) => {
  send(ws, 'collaboration_reset', await buildCollaborationResetPayload(documentId));
};

let broadcastParticipantList = async (documentId: string) => {
  let actorIds = await getActiveActorIds(documentId);
  let payload =
    actorIds.length === 0
      ? []
      : (
          await db.documentParticipant.findMany({
            where: {
              document: {
                id: documentId
              },
              resourceActor: {
                id: {
                  in: actorIds
                }
              }
            },
            include: {
              document: true,
              resourceActor: true
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
          .map(presentDocumentParticipant)
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

  if (await shouldPublishParticipantPayload(documentId, serialized, participantTimeoutMs)) {
    await publishDocumentLiveBusMessage({
      documentId,
      type: 'participant_list',
      data: payload
    });
  }
};

let removeSession = async (sessionId: string) => {
  let session = liveSessions.get(sessionId);
  if (!session) return;

  liveSessions.delete(sessionId);
  socketsBySessionId.delete(sessionId);
  if (session.expiryTimer) clearTimeout(session.expiryTimer);
  await removeLiveSession(session.documentId, sessionId);

  let room = sessionIdsByDocumentId.get(session.documentId);
  if (room) {
    room.delete(sessionId);
    if (room.size === 0) {
      sessionIdsByDocumentId.delete(session.documentId);
      lastParticipantPayloadByDocumentId.delete(session.documentId);
    }
  }

  if (typeof session.awarenessClientId == 'number') {
    await broadcastDistributedToDocument(
      session.documentId,
      'awareness_remove',
      {
        sessionId,
        actorId: session.actorId,
        clientId: session.awarenessClientId
      },
      sessionId
    );
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

type DocumentLiveConnection = {
  documentId: string;
  instanceId: string;
  organizationId: string;
  actorId: string;
  context: Context;
  authorization: ResourceAuthorization;
  permissions: ('content_read' | 'content_write')[];
  expiresAt: Date;
  defaultPermissions?: StoreParticipantPermissions[];
  overridePermissions?: boolean;
};

type DocumentLiveApiOptions = {
  path?: string;
  resolveConnection: (d: { request: Request; url: URL }) => Promise<DocumentLiveConnection>;
  resolveToken: (d: {
    token: string;
    documentId: string;
    instanceId: string;
    organizationId: string;
    context: Context;
  }) => Promise<DocumentLiveConnection>;
};

let getConnectionAccessPayload = (session: LiveSession) => ({
  permissions: session.permissions,
  expiresAt: new Date(session.expiresAt)
});

let scheduleSessionExpiry = (session: LiveSession, ws: WSContext<any>) => {
  if (session.expiryTimer) clearTimeout(session.expiryTimer);
  session.expiryTimer = setTimeout(
    () => {
      send(ws, 'error', {
        code: 'document_token_expired',
        message: 'The document edit token has expired'
      });
      ws.close(4001, 'Document edit token expired');
    },
    Math.max(0, session.expiresAt - Date.now())
  );
};

export let createDocumentLiveApi = (options: DocumentLiveApiOptions) =>
  createHono()
    .get('/ping', c => c.text('OK'))
    .get(
      options.path ?? '/document-live',
      upgradeWebSocket(async c => {
        let url = new URL(c.req.url);
        let connection = await options.resolveConnection({
          request: c.req.raw,
          url
        });
        let {
          documentId,
          instanceId,
          organizationId,
          actorId,
          context,
          authorization,
          permissions,
          expiresAt,
          defaultPermissions,
          overridePermissions
        } = connection;

        let scopedDocument = await documentService.getScopedDocumentById({
          documentId
        });

        await documentService.getDocumentById({
          project: scopedDocument.project,
          instance: scopedDocument.instance,
          documentId,
          authorization,
          defaultPermissions,
          overridePermissions
        });

        let sessionId = generatePlainId(20);

        return {
          onOpen: async (_, ws) => {
            let session: LiveSession = {
              id: sessionId,
              documentId,
              instanceId,
              organizationId,
              actorId,
              context,
              authorization,
              permissions,
              canWrite: permissions.includes('content_write'),
              expiresAt: expiresAt.getTime(),
              defaultPermissions,
              overridePermissions,
              lastPingAt: Date.now()
            };

            if (isDocumentLiveTokenExpired(session.expiresAt)) {
              ws.close(4001, 'Document edit token expired');
              return;
            }

            liveSessions.set(sessionId, session);
            socketsBySessionId.set(sessionId, ws);
            getRoomSessionIds(documentId).add(sessionId);
            await persistLiveSession(session);
            scheduleSessionExpiry(session, ws);

            let collaboration =
              await internalDocumentCollaborationService.getSnapshot(documentId);
            send(ws, 'document_snapshot', buildDocumentPayload(scopedDocument.document));
            send(ws, 'collaboration_snapshot', {
              sessionId,
              document: buildDocumentPayload(scopedDocument.document),
              stateUpdate: collaboration.update,
              generation: collaboration.generation,
              awareness: await getAwarenessPayload(documentId),
              access: getConnectionAccessPayload(session)
            });
            await broadcastParticipantList(documentId);
          },

          onMessage: async event => {
            let session = liveSessions.get(sessionId);
            if (!session) return;

            if (isDocumentLiveTokenExpired(session.expiresAt)) {
              let ws = socketsBySessionId.get(sessionId);
              if (ws) ws.close(4001, 'Document edit token expired');
              await removeSession(sessionId);
              return;
            }

            session.lastPingAt = Date.now();
            let tokenUpdateRequestId: string | null = null;

            try {
              let parsed = JSON.parse(event.data.toString()) as DocumentLiveClientMessage;
              await persistLiveSession(session);

              if (parsed.type === 'document_token_update') {
                tokenUpdateRequestId = parsed.data?.requestId ?? null;
                if (
                  !parsed.data ||
                  typeof parsed.data.token != 'string' ||
                  typeof parsed.data.requestId != 'string' ||
                  !parsed.data.requestId
                ) {
                  throw new ServiceError(
                    forbiddenError({ message: 'Invalid document token update' })
                  );
                }

                let refreshed = await options.resolveToken({
                  token: parsed.data.token,
                  documentId: session.documentId,
                  instanceId: session.instanceId,
                  organizationId: session.organizationId,
                  context: session.context
                });
                if (!hasSameDocumentLiveIdentity(session, refreshed)) {
                  throw new ServiceError(
                    forbiddenError({ message: 'Document token identity cannot be changed' })
                  );
                }

                session.authorization = refreshed.authorization;
                session.permissions = refreshed.permissions;
                session.canWrite = refreshed.permissions.includes('content_write');
                session.expiresAt = refreshed.expiresAt.getTime();
                session.defaultPermissions = refreshed.defaultPermissions;
                session.overridePermissions = refreshed.overridePermissions;
                await persistLiveSession(session);

                let ws = socketsBySessionId.get(sessionId);
                if (ws) {
                  scheduleSessionExpiry(session, ws);
                  send(ws, 'document_token_updated', {
                    requestId: parsed.data.requestId,
                    ...getConnectionAccessPayload(session)
                  });
                }
                return;
              }

              if (parsed.type === 'ping') {
                let ws = socketsBySessionId.get(sessionId);
                if (ws) {
                  send(ws, 'pong', {
                    documentId: session.documentId
                  });
                }
                return;
              }

              if (
                !canSendDocumentLiveMessage({
                  canWrite: session.canWrite,
                  type: parsed.type
                })
              ) {
                let ws = socketsBySessionId.get(sessionId);
                if (ws) {
                  send(ws, 'error', {
                    code: 'document_read_only',
                    message: 'This live document connection is read-only'
                  });
                }
                return;
              }

              if (parsed.type === 'yjs_update') {
                if (typeof parsed.data?.update !== 'string') {
                  throw new Error('Invalid live document Yjs update payload');
                }

                if (scopedDocument.document.isReadOnly) {
                  let ws = socketsBySessionId.get(sessionId);
                  if (ws) await sendCollaborationReset(ws, session.documentId);
                  return;
                }

                let merged = await internalDocumentCollaborationService.mergeUpdate({
                  documentId: session.documentId,
                  update: parsed.data.update,
                  actorId: session.actorId,
                  actorContext: session.context,
                  generation:
                    typeof parsed.data.generation === 'number' ? parsed.data.generation : 0
                });
                if (merged.stale) {
                  let ws = socketsBySessionId.get(sessionId);
                  if (ws) await sendCollaborationReset(ws, session.documentId);
                  return;
                }
                await queueDocumentCollaborationFlush(session.documentId, merged.revision);

                await broadcastDistributedToDocumentExcept(
                  session.documentId,
                  sessionId,
                  'yjs_update',
                  {
                    sessionId,
                    actorId: session.actorId,
                    update: parsed.data.update,
                    generation: merged.generation
                  }
                );
                return;
              }

              if (parsed.type === 'yjs_state_initialize') {
                if (typeof parsed.data?.update !== 'string') {
                  throw new Error('Invalid live document Yjs state initialize payload');
                }

                if (scopedDocument.document.isReadOnly) {
                  let ws = socketsBySessionId.get(sessionId);
                  if (ws) await sendCollaborationReset(ws, session.documentId);
                  return;
                }

                let initialized = await internalDocumentCollaborationService.initializeState({
                  documentId: session.documentId,
                  update: parsed.data.update,
                  generation:
                    typeof parsed.data.generation === 'number' ? parsed.data.generation : 0
                });
                let ws = socketsBySessionId.get(sessionId);
                if (initialized.stale) {
                  if (ws) await sendCollaborationReset(ws, session.documentId);
                  return;
                }
                if (ws) {
                  send(ws, 'yjs_state_initialized', initialized);
                }
                return;
              }

              if (parsed.type === 'awareness_update') {
                if (
                  typeof parsed.data?.clientId !== 'number' ||
                  typeof parsed.data?.update !== 'string'
                ) {
                  throw new Error('Invalid live document awareness payload');
                }

                session.awarenessClientId = parsed.data.clientId;
                session.awarenessUpdate = parsed.data.update;
                await persistLiveSession(session);

                await broadcastDistributedToDocumentExcept(
                  session.documentId,
                  sessionId,
                  'awareness_update',
                  {
                    sessionId,
                    actorId: session.actorId,
                    clientId: parsed.data.clientId,
                    update: parsed.data.update
                  }
                );
                return;
              }

              if (
                parsed.type !== 'document_update' &&
                parsed.type !== 'document_title_update' &&
                parsed.type !== 'document_snapshot_save'
              ) {
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

              if (
                parsed.type === 'document_snapshot_save' &&
                (typeof parsed.data?.content !== 'string' ||
                  typeof parsed.data?.title !== 'string')
              ) {
                throw new Error('Invalid live document snapshot payload');
              }

              let currentScopedDocument = await documentService.getScopedDocumentById({
                documentId: session.documentId
              });

              await documentService.getDocumentById({
                project: currentScopedDocument.project,
                instance: currentScopedDocument.instance,
                documentId: session.documentId,
                authorization: session.authorization,
                defaultPermissions: session.defaultPermissions,
                overridePermissions: session.overridePermissions
              });

              let updatedDocument = await documentService.updateDocument({
                project: currentScopedDocument.project,
                instance: currentScopedDocument.instance,
                document: currentScopedDocument.document,
                input: {
                  authorization: session.authorization,
                  context: session.context,
                  title: parsed.data.title,
                  content:
                    parsed.type === 'document_update' ||
                    parsed.type === 'document_snapshot_save'
                      ? parsed.data.content
                      : undefined
                }
              });

              await broadcastDistributedToDocument(
                updatedDocument.id,
                parsed.type === 'document_snapshot_save'
                  ? 'document_snapshot_saved'
                  : 'document_snapshot',
                buildDocumentPayload(updatedDocument),
                sessionId
              );

              let childDocuments =
                await internalDocumentSyncService.listLinkedChildDocumentsForLiveSync({
                  parentDocumentId: updatedDocument.id
                });
              let sharedContent =
                updatedDocument.resolvedContent ?? updatedDocument.content.content;
              let sharedUpdatedAt =
                updatedDocument.draftUpdatedAt ?? updatedDocument.updatedAt;

              for (let childDocument of childDocuments) {
                await broadcastDistributedToDocument(
                  childDocument.id,
                  'document_snapshot',
                  buildDocumentPayload(childDocument, {
                    content: sharedContent,
                    updatedAt: sharedUpdatedAt
                  }),
                  sessionId
                );
              }

              await broadcastParticipantList(updatedDocument.id);
            } catch (error) {
              let ws = socketsBySessionId.get(sessionId);
              if (ws) {
                if (tokenUpdateRequestId) {
                  send(ws, 'error', {
                    code: 'document_token_update_failed',
                    requestId: tokenUpdateRequestId,
                    error: isServiceError(error)
                      ? error.toResponse()
                      : internalServerError().toResponse()
                  });
                } else {
                  sendError(ws, error);
                }
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
