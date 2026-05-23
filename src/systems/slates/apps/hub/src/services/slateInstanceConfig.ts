import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {};

class slateInstanceConfigServiceImpl {
  async getSlateInstanceConfigById(d: { tenant: Tenant; id: string }) {
    let slateInstanceConfig = await db.slateInstanceConfig.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id
      },
      include
    });
    if (!slateInstanceConfig) throw new ServiceError(notFoundError('slate.instance.config'));
    return slateInstanceConfig;
  }

  async listSlateInstanceConfigs(d: { tenant: Tenant; slateInstanceIds?: string[] }) {
    let slateInstances = d.slateInstanceIds
      ? await db.slateInstance.findMany({
          where: { id: { in: d.slateInstanceIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateInstanceConfig.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,

              instanceOid: slateInstances
                ? { in: slateInstances.map(si => si.oid) }
                : undefined
            },
            include
          })
      )
    );
  }

  async getManySlateInstanceConfigsByIds(d: { ids: string[]; tenant: Tenant }) {
    return db.slateInstanceConfig.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slateInstanceConfigService = Service.create(
  'slateInstanceConfigService',
  () => new slateInstanceConfigServiceImpl()
).build();
