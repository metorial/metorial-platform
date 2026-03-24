import {
  db,
  getId,
  type ProviderRun,
  type Session,
  type SessionConnection,
  type SessionErrorType,
  type SessionMessageFailureReason
} from '@metorial-subspace/db';
import { createErrorQueue } from '../queues/error/createError';

export interface CreateErrorProps {
  session: Session;
  connection: SessionConnection | null | undefined;
  providerRun?: ProviderRun;

  type: SessionErrorType;
  output: PrismaJson.SessionMessageOutput;
}

export let messageFailureReasonToErrorType = (
  reason: SessionMessageFailureReason
): SessionErrorType => {
  return {
    none: 'message_processing_provider_error' as const,
    timeout: 'message_processing_timeout' as const,
    provider_error: 'message_processing_provider_error' as const,
    system_error: 'message_processing_system_error' as const
  }[reason];
};

export let createError = async (props: CreateErrorProps) => {
  if (props.output.type !== 'error') return;

  let code = props.output.data.code ?? 'unknown';
  let message =
    props.output.data.message ?? props.output.data.code ?? 'An unknown error occurred.';

  let error = await db.sessionError.create({
    data: {
      ...getId('sessionError'),

      type: props.type,
      code,
      message,

      isProcessing: true,

      payload: props.output.data,

      sessionOid: props.session.oid,
      connectionOid: props.connection?.oid,
      providerRunOid: props.providerRun?.oid,
      tenantOid: props.session.tenantOid,
      solutionOid: props.session.solutionOid,
      environmentOid: props.session.environmentOid
    }
  });

  await createErrorQueue.add({ errorId: error.id });

  return error;
};
