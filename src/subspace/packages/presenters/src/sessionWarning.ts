import {
  type Session,
  type SessionConnection,
  type SessionWarning
} from '@metorial-subspace/db';

export type SessionWarningPresenterProps = SessionWarning & {
  session: Session;
  connection: SessionConnection | null;
};

export let sessionWarningPresenter = (error: SessionWarningPresenterProps) => ({
  object: 'session.warning',

  id: error.id,

  code: error.code,
  message: error.message,

  data: error.payload,

  sessionId: error.session.id,
  connectionId: error.connection?.id ?? null,

  createdAt: error.createdAt
});
