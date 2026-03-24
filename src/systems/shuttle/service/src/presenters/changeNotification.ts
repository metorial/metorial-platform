import type {
  ChangeNotification,
  Server,
  ServerVersion,
  Tenant
} from '../../prisma/generated/client';

export let changeNotificationPresenter = (
  changeNotification: ChangeNotification & {
    server: (Server & { tenant: Tenant | null }) | null;
    serverVersion: ServerVersion | null;
  }
) => ({
  object: 'shuttle#change_notification',

  id: changeNotification.id,

  type: changeNotification.type,

  serverId: changeNotification.server?.id,
  serverVersionId: changeNotification.serverVersion?.id,
  tenantId: changeNotification.server?.tenant?.id,

  createdAt: changeNotification.createdAt
});
