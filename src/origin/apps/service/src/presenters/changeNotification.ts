import type {
  ChangeNotification,
  ScmAccount,
  ScmRepository,
  ScmRepositoryPush,
  ScmRepositorySync,
  Tenant
} from '../../prisma/generated/client';
import { repositoryPresenter } from './repository';
import { scmRepositoryPushPresenter } from './scmRepositoryPush';
import { scmRepositorySyncPresenter } from './scmRepositorySync';

export let changeNotificationPresenter = (
  notification: ChangeNotification & {
    repo: ScmRepository & { account: ScmAccount };
    repoPush: ScmRepositoryPush | null;
    repositorySync: ScmRepositorySync | null;
    tenant: Tenant;
  }
) => ({
  object: 'origin#changeNotification' as const,

  id: notification.id,
  type: notification.type,

  repo: repositoryPresenter(notification.repo),
  repoPush: notification.repoPush
    ? scmRepositoryPushPresenter({
        ...notification.repoPush,
        repo: notification.repo
      })
    : undefined,
  repositorySync: notification.repositorySync
    ? scmRepositorySyncPresenter(notification.repositorySync)
    : undefined,

  tenantId: notification.tenant.id,

  createdAt: notification.createdAt
});
