import type {
  ProviderTool,
  Session,
  SessionConnection,
  SessionMessage,
  SessionParticipant,
  SessionProvider,
  ToolCall
} from '@metorial-subspace/db';
import { createAuditRecorder } from '@metorial/audit-stash';
import { subspaceAuditResources } from '@metorial/audit-resources-subspace';
import { getDataPlaneAuditScope, getParticipantAuditActor } from './scope';

let recorder = createAuditRecorder(subspaceAuditResources);

let record = async (write: () => Promise<void>) => {
  try {
    await write();
  } catch (error) {
    console.error('[Audit] Failed to record subspace data plane audit event', error);
  }
};

export type AuditableMessage = SessionMessage & {
  session: Session;
  sessionProvider: (SessionProvider & { provider: { id: string; name: string } }) | null;
  connection: Pick<SessionConnection, 'id'> | null;
  senderParticipant: SessionParticipant & {
    identity?: { id: string } | null;
    identityActor?: { id: string } | null;
  };
  toolCall: (ToolCall & { tool: Pick<ProviderTool, 'key'> }) | null;
};

export let isAuditableMessage = (message: {
  isProductive: boolean;
  toolCall: unknown | null;
}) => message.isProductive || message.toolCall !== null;

export let recordMessageAuditEvent = async (message: AuditableMessage) =>
  await record(async () => {
    if (!isAuditableMessage(message)) return;
    if (!message.senderParticipant) return;

    let retentionLevel = message.retentionLevel;
    let withholdIntent = retentionLevel === 'none';

    let scope = await getDataPlaneAuditScope({
      instanceOid: message.instanceOid,
      actor: getParticipantAuditActor(message.senderParticipant)
    });
    if (!scope) return;

    await recorder.recordEvent(scope, 'session_message', 'create', {
      payload: {
        id: message.id,
        status: message.status,
        type: message.type,
        source: message.source,
        transport: message.transport,
        failureReason: message.failureReason,
        isProductive: message.isProductive,
        retentionLevel,
        sessionId: message.session.id,
        sessionProvider: message.sessionProvider
          ? {
              id: message.sessionProvider.id,
              tag: message.sessionProvider.tag,
              provider: {
                id: message.sessionProvider.provider.id,
                name: message.sessionProvider.provider.name
              }
            }
          : null,
        connectionId: message.connection?.id ?? null,
        methodOrToolKey: withholdIntent ? null : message.methodOrToolKey,
        toolCall:
          withholdIntent || !message.toolCall
            ? null
            : {
                id: message.toolCall.id,
                toolKey: message.toolCall.toolKey,
                rationale: message.toolCall.rationale,
                operation: message.toolCall.operation
              },
        createdAt: message.createdAt,
        completedAt: message.completedAt
      },
      recordedAt: message.createdAt
    });
  });

export type AuditableConnection = SessionConnection & {
  session: Pick<Session, 'id'>;
  participant:
    | (SessionParticipant & {
        identity?: { id: string } | null;
        identityActor?: { id: string } | null;
      })
    | null;
};

export let recordConnectionAuditEvent = async (connection: AuditableConnection) =>
  await record(async () => {
    let scope = await getDataPlaneAuditScope({
      instanceOid: connection.instanceOid,
      actor: connection.participant
        ? getParticipantAuditActor(connection.participant)
        : { type: 'system', id: 'subspace/connection' }
    });
    if (!scope) return;

    let clientInfo = connection.mcpData?.clientInfo;

    await recorder.recordEvent(scope, 'session_connection', 'create', {
      payload: {
        id: connection.id,
        status: connection.status,
        transport: connection.transport,
        mcpTransport: connection.mcpTransport,
        mcpProtocolVersion: connection.mcpProtocolVersion,
        isEphemeral: connection.isEphemeral,
        isForManualToolCalls: connection.isForManualToolCalls,
        sessionId: connection.session.id,
        client: {
          name: clientInfo?.name ?? null,
          version: clientInfo?.version ?? null
        },
        participant: connection.participant
          ? {
              id: connection.participant.id,
              type: connection.participant.type,
              name: connection.participant.name,
              identityId: connection.participant.identity?.id ?? null,
              identityActorId: connection.participant.identityActor?.id ?? null
            }
          : null,
        expiresAt: connection.expiresAt
      },
      recordedAt: connection.createdAt
    });
  });
