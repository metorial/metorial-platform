import { db, getId, type Session, type SessionConnection } from '@metorial-subspace/db';
import { createWarningQueue } from '../queues/error/createWarning';

export interface CreateWarningProps {
  connection: SessionConnection | null | undefined;
  session: Session;

  warning: {
    code: string;
    message: string;
    payload: Record<string, any>;
  };
}

export let createWarning = async (props: CreateWarningProps) => {
  let warning = await db.sessionWarning.create({
    data: {
      ...getId('sessionWarning'),

      code: props.warning.code,
      message: props.warning.message,
      payload: props.warning.payload,

      sessionOid: props.session.oid,
      tenantOid: props.session.tenantOid,
      connectionOid: props.connection?.oid,
      solutionOid: props.session.solutionOid,
      environmentOid: props.session.environmentOid
    }
  });

  await createWarningQueue.add({ warningId: warning.id });

  return warning;
};
