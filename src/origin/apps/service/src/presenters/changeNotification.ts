import type {
  ChangeNotification,
  ScmAccount,
  ScmRepository,
  ScmRepositoryPush,
  Tenant
} from '../../prisma/generated/client';
import { repositoryPresenter } from './repository';
import { scmRepositoryPushPresenter } from './scmRepositoryPush';
import {
  type PresentableScmRepositorySync,
  scmRepositorySyncPresenter
} from './scmRepositorySync';

export let changeNotificationPresenter = (
  notification: ChangeNotification & {
    repo: ScmRepository & { account: ScmAccount };
    repoPush: ScmRepositoryPush | null;
    repositorySync: PresentableScmRepositorySync | null;
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
