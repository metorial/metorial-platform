import { sessionMessageBucketRecord } from '@metorial-subspace/connection-utils';
import {
  db,
  getId,
  type ProviderTool,
  type Session,
  type SessionConnection,
  type SessionConnectionTransport,
  type SessionError,
  type SessionMessage,
  type SessionMessageFailureReason,
  type SessionMessageSource,
  type SessionMessageStatus,
  type SessionMessageType,
  type SessionParticipant,
  type SessionProvider
} from '@metorial-subspace/db';
import { messageCreatedQueue } from '../queues/message/messageCreated';
import { createError, messageFailureReasonToErrorType } from './createError';

export interface CreateMessageProps {
  status: SessionMessageStatus;
  type: SessionMessageType;
  source: SessionMessageSource;
  senderParticipant: SessionParticipant;
  transport: SessionConnectionTransport;
  failureReason?: SessionMessageFailureReason;

  input: PrismaJson.SessionMessageInput;
  output?: PrismaJson.SessionMessageOutput;
  responderParticipant?: SessionParticipant;

  parentMessage?: SessionMessage;

  provider?: SessionProvider;

  tool?: ProviderTool;
  methodOrToolKey?: string;

  isProductive: boolean;

  clientMcpId?: PrismaJson.SessionMessageClientMcpId;
  providerMcpId?: string;

  completedAt?: Date;
}

export interface CreateMessagePropsFull extends CreateMessageProps {
  session: Session;
  connection: SessionConnection | null;
}

export let createMessage = async (data: CreateMessagePropsFull) => {
  if (data.output && !data.responderParticipant) {
    throw new Error('responderParticipant is required when output is provided');
  }

  if (data.output?.type === 'error') {
    data.status = 'failed';
  }

  if (data.status && data.status !== 'waiting_for_response') {
    data.completedAt = data.completedAt ?? new Date();
  }

  if (data.status === 'failed' && (!data.failureReason || data.failureReason === 'none')) {
    data.failureReason = 'provider_error';
  }

  if (data.status === 'failed' && !data.output) {
    data.output = {
      type: 'error',
      data: { code: 'unknown', message: 'An unknown error occurred' }
    };
  }

  let error: SessionError | undefined;
  if (data.status === 'failed') {
    error = await createError({
      type: messageFailureReasonToErrorType(data.failureReason ?? 'provider_error'),
      session: data.session,
      connection: data.connection,
      output: data.output!
    });
  }

  let message = await db.sessionMessage.create({
    data: {
      ...getId('sessionMessage'),
      type: 'tool_call',
      status: data.status,
      source: data.source,
      transport: data.transport,

      isProductive: data.isProductive,
      failureReason: data.failureReason ?? 'none',
      completedAt: data.completedAt,

      errorOid: error?.oid,
      sessionOid: data.session.oid,
      connectionOid: data.connection?.oid,
      tenantOid: data.session.tenantOid,
      solutionOid: data.session.solutionOid,
      sessionProviderOid: data.provider?.oid,
      bucketOid: sessionMessageBucketRecord.oid,
      parentMessageOid: data.parentMessage?.oid,
      environmentOid: data.session.environmentOid,
      senderParticipantOid: data.senderParticipant.oid,
      responderParticipantOid: data.responderParticipant?.oid,

      input: data.input,
      output: data.output,

      methodOrToolKey: data.tool?.key ?? data.methodOrToolKey ?? null,
      clientMcpId: data.clientMcpId ?? null,
      providerMcpId: data.providerMcpId ?? null,

      toolCall: data.tool
        ? {
            create: {
              ...getId('toolCall'),
              toolOid: data.tool.oid,
              toolKey: data.tool.key,
              sessionOid: data.session.oid,
              tenantOid: data.session.tenantOid,
              solutionOid: data.session.solutionOid,
              environmentOid: data.session.environmentOid
            }
          }
        : undefined
    }
  });

  await db.sessionEvent.createMany({
    data: {
      ...getId('sessionEvent'),
      type: 'message_created',
      sessionOid: message.sessionOid,
      connectionOid: message.connectionOid,
      providerRunOid: message.providerRunOid,
      messageOid: message.oid,
      tenantOid: message.tenantOid,
      solutionOid: message.solutionOid,
      environmentOid: message.environmentOid
    }
  });

  if (message.status !== 'waiting_for_response') {
    await db.sessionEvent.createMany({
      data: {
        ...getId('sessionEvent'),
        type: 'message_processed',
        sessionOid: message.sessionOid,
        connectionOid: message.connectionOid,
        providerRunOid: message.providerRunOid,
        messageOid: message.oid,
        tenantOid: message.tenantOid,
        solutionOid: message.solutionOid,
        environmentOid: message.environmentOid
      }
    });
  }

  await messageCreatedQueue.add({ messageId: message.id });

  return message;
};
