import type {
  ChangeNotification,
  ScmAccount,
  ScmRepository,
  ScmRepositoryPush,
  Tenant
} from '../../prisma/generated/client';
import { repositoryPresenter } from './repository';
import { scmRepositoryPushPresenter } from './scmRepositoryPush';

export let changeNotificationPresenter = (
  notification: ChangeNotification & {
    repo: ScmRepository & { account: ScmAccount };
    repoPush: ScmRepositoryPush | null;
    tenant: Tenant;
  }
) => ({
  object: 'origin#changeNotification',

  id: notification.id,
  type: notification.type,

  repo: repositoryPresenter(notification.repo),
  repoPush: notification.repoPush
    ? scmRepositoryPushPresenter({
        ...notification.repoPush,
        repo: notification.repo
      })
    : undefined,

  tenantId: notification.tenant.id,

  createdAt: notification.createdAt
});
