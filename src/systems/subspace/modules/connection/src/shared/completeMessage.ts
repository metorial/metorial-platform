import {
  db,
  getId,
  type ProviderRun,
  type SessionError,
  type SessionMessageFailureReason,
  type SessionParticipant
} from '@metorial-subspace/db';
import { finalizeMessageQueue } from '../queues/message/finalizeMessage';
import { createError, messageFailureReasonToErrorType } from './createError';

export interface UpdateMessageData {
  status: 'failed' | 'succeeded';
  output: PrismaJson.SessionMessageOutput;
  failureReason?: SessionMessageFailureReason;
  responderParticipant: SessionParticipant;
  completedAt?: Date;

  providerRun?: ProviderRun;
  slateToolCall?: { oid: bigint };
}

export let completeMessage = async (
  filter: { messageId: string } | { messageOid: bigint },
  data: UpdateMessageData
) => {
  data.completedAt = data.completedAt ?? new Date();

  if (data.output?.type === 'error') {
    data.status = 'failed';
  }

  if (data.status === 'failed' && !data.failureReason) {
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
    let message = await db.sessionMessage.findFirstOrThrow({
      where: 'messageId' in filter ? { id: filter.messageId } : { oid: filter.messageOid },
      include: { connection: true, session: true }
    });

    error = await createError({
      type: messageFailureReasonToErrorType(data.failureReason ?? 'provider_error'),
      session: message.session,
      connection: message.connection,
      output: data.output!,
      providerRun: data.providerRun
    });
  }

  let message = await db.sessionMessage.update({
    where: {
      ...('messageId' in filter ? { id: filter.messageId } : { oid: filter.messageOid }),
      status: 'waiting_for_response'
    },
    data: {
      output: data.output,
      status: data.status,
      completedAt: data.completedAt ?? new Date(),
      failureReason: data.failureReason,

      errorOid: error?.oid,
      providerRunOid: data.providerRun?.oid,
      slateToolCallOid: data.slateToolCall?.oid,
      responderParticipantOid: data.responderParticipant.oid
    },
    include: { toolCall: true }
  });

  if (message.toolCall) {
    await db.toolCall.updateMany({
      where: { oid: message.toolCall.oid },
      data: { providerRunOid: message.providerRunOid }
    });
  }

  (async () => {
    await db.sessionEvent.updateMany({
      where: { messageOid: message.oid },
      data: {
        providerRunOid: message.providerRunOid,
        connectionOid: message.connectionOid,
        sessionOid: message.sessionOid,
        errorOid: message.errorOid
      }
    });

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

    await finalizeMessageQueue.add({ messageId: message.id });
  })().catch(() => {});

  return message;
};
