import type { ScmInstallation, ScmInstallationSession } from '../../prisma/generated/client';
import { env } from '../env';
import { scmInstallationPresenter } from './scmInstallation';

export let presentScmInstallationSession = (
  session: ScmInstallationSession & {
    installation: ScmInstallation | null;
  }
) => ({
  id: session.id,
  url: `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/scm/installation-session/${session.id}`,

  status: session.installation
    ? ('completed' as const)
    : session.expiresAt < new Date()
      ? ('expired' as const)
      : ('pending' as const),

  installation: session.installation ? scmInstallationPresenter(session.installation) : null,

  createdAt: session.createdAt,
  expiresAt: session.expiresAt
});
