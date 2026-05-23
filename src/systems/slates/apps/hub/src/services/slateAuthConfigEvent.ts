import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  config: {
    include: {
      authMethod: true
    }
  },
  invocation: {
    include: {
      slateInvocationAttachment: {
        include: {
          attachments: true
        }
      }
    }
  }
};

class slateAuthConfigEventServiceImpl {
  async listSlateAuthConfigEvents(d: { tenant: Tenant; authConfigIds?: string[] }) {
    let authConfigs = d.authConfigIds
      ? await db.slateAuthConfig.findMany({
          where: { id: { in: d.authConfigIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await db.slateAuthConfigEvent.findMany({
          ...opts,
          where: {
            id: { not: null },
            config: { tenantOid: d.tenant.oid },
            configOid: authConfigs ? { in: authConfigs.map(c => c.oid) } : undefined
          },
          include
        });

        return res.map(e => ({
          ...e,
          id: e.id!
        }));
      })
    );
  }

  async listSlateAuthConfigEventsGlobal(d: { authConfigIds?: string[] }) {
    let authConfigs = d.authConfigIds
      ? await db.slateAuthConfig.findMany({
          where: { id: { in: d.authConfigIds } }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await db.slateAuthConfigEvent.findMany({
          ...opts,
          where: {
            id: { not: null },
            configOid: authConfigs ? { in: authConfigs.map(c => c.oid) } : undefined
          },
          include
        });

        return res.map(e => ({
          ...e,
          id: e.id!
        }));
      })
    );
  }
}

export let slateAuthConfigEventService = Service.create(
  'slateAuthConfigEventService',
  () => new slateAuthConfigEventServiceImpl()
).build();
