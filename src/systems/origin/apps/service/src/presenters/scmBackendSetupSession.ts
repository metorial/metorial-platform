import type { ScmBackend } from '../../prisma/generated/browser';
import type {
  ScmBackendSetupSession,
  ScmInstallationSession
} from '../../prisma/generated/client';
import { env } from '../env';
import { scmBackendPresenter } from './scmBackend';

export let presentScmBackendSetupSession = (
  session: ScmBackendSetupSession & {
    backend: ScmBackend | null;
    parentInstallationSession: ScmInstallationSession | null;
  }
) => ({
  object: 'origin#scmBackendSetupSession',
  id: session.id,
  type: session.type,
  url: `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/scm/backend-setup/${session.id}`,

  parentInstallationSessionId: session.parentInstallationSession?.id ?? null,

  status: session.backend
    ? ('completed' as const)
    : session.expiresAt < new Date()
      ? ('expired' as const)
      : ('pending' as const),

  backend: session.backend ? scmBackendPresenter(session.backend) : null,

  createdAt: session.createdAt,
  expiresAt: session.expiresAt
});
