import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import {
  buildChangeNotificationFilterClause,
  type SubRegistryWithFilters
} from '../lib/subRegistryFilter';

class changeNotificationServiceImpl {
  private buildVisibilityClause(supportsPrebuilt?: boolean) {
    if (supportsPrebuilt === true) return {};

    return {
      OR: [{ slateVersionOid: null }, { slateVersion: { backend: 'local_unbuilt' as const } }]
    };
  }

  async getChangeNotificationById(d: {
    id: string;
    tenant?: Tenant;
    subRegistry?: SubRegistryWithFilters | null;
    supportsPrebuilt?: boolean;
  }) {
    let filterClause = buildChangeNotificationFilterClause(d.subRegistry, d.tenant?.oid);
    let visibilityClause = this.buildVisibilityClause(d.supportsPrebuilt);

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
    let visibilityClause = this.buildVisibilityClause(d.supportsPrebuilt);

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
