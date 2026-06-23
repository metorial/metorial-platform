import { delay } from '@lowerdeck/delay';
import {
  db,
  type ProviderRun,
  type Session,
  type SessionConnection,
  type SessionError,
  type SessionErrorGroup
} from '@metorial-subspace/db';

export type SessionErrorPresenterProps = SessionError & {
  session: Session;
  group: SessionErrorGroup | null;
  providerRun: ProviderRun | null;
  connection: SessionConnection | null;
};

export let sessionErrorPresenter = async (error: SessionErrorPresenterProps) => {
  try {
    let i = 0;
    while (error.isProcessing || !error.group) {
      if (i++ >= 10) break;

      await delay(250);

      let refreshedError = await db.sessionError.findUniqueOrThrow({
        where: { oid: error.oid },
        include: { group: true }
      });

      error = Object.assign(error, refreshedError);
    }
  } catch (err) {
    console.error('Error refreshing session error for presenter', err);
  }

  return {
    object: 'session.error',

    id: error.id,

    status: error.isProcessing ? ('processing' as const) : ('processed' as const),

    code: error.code,
    message: error.message,

    data: error.payload,

    sessionId: error.session.id,
    providerRunId: error.providerRun?.id ?? null,
    connectionId: error.connection?.id ?? null,

    groupId: error.group?.id ?? null,
    similarErrorCount: error.group?.occurrenceCount ?? 0,

    createdAt: error.createdAt
  };
};
