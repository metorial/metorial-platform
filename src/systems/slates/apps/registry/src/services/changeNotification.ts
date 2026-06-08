import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import {
  buildChangeNotificationFilterClause,
  type SubRegistryWithFilters
} from '../lib/subRegistryFilter';
import { buildChangeNotificationSupportsPrebuiltWhere } from '../lib/slateVersion/visibility';

class changeNotificationServiceImpl {
  async getChangeNotificationById(d: {
    id: string;
    tenant?: Tenant;
    subRegistry?: SubRegistryWithFilters | null;
    supportsPrebuilt?: boolean;
  }) {
    let filterClause = buildChangeNotificationFilterClause(d.subRegistry, d.tenant?.oid);
    let visibilityClause = buildChangeNotificationSupportsPrebuiltWhere(d.supportsPrebuilt);

    let notification = await db.changeNotification.findFirst({
      where: {
        AND: [{ id: d.id }, filterClause, visibilityClause]
      }
    });
    if (!notification) throw new ServiceError(notFoundError('change_notification'));
    return notification;
  }

  async listChangeNotifications(d: {
    tenant?: Tenant;
    subRegistry?: SubRegistryWithFilters | null;
    supportsPrebuilt?: boolean;
  }) {
    let filterClause = buildChangeNotificationFilterClause(d.subRegistry, d.tenant?.oid);
    let visibilityClause = buildChangeNotificationSupportsPrebuiltWhere(d.supportsPrebuilt);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.changeNotification.findMany({
            ...opts,
            where: {
              AND: [filterClause, visibilityClause]
            }
          })
      )
    );
  }
}

export let changeNotificationService = Service.create(
  'changeNotificationService',
  () => new changeNotificationServiceImpl()
).build();
