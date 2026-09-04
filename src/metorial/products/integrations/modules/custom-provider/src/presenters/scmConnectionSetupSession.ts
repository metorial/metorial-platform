import type { ScmConnectionSetupSession } from '../origin';
import { scmConnectionPresenter } from './scmConnection';

export let scmConnectionSetupSessionPresenter = (
  scmConnectionSetupSession: ScmConnectionSetupSession
) => ({
  object: 'scm.connection.setup_session',

  id: scmConnectionSetupSession.id,

  url: scmConnectionSetupSession.url,
  status: scmConnectionSetupSession.status,

  connection: scmConnectionSetupSession.installation
    ? scmConnectionPresenter(scmConnectionSetupSession.installation)
    : null,

  createdAt: scmConnectionSetupSession.createdAt,
  expiresAt: scmConnectionSetupSession.expiresAt
});
