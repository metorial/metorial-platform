import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
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
  async listSlateAuthConfigEvents(d: {
    tenant: Tenant;
    authConfigIds?: string[];
  }) {
    let authConfigs = d.authConfigIds
      ? await db.slateAuthConfig.findMany({
          where: { id: { in: d.authConfigIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateAuthConfigEvent.findMany({
            ...opts,
            where: {
              config: { tenantOid: d.tenant.oid },

              configOid: authConfigs
                ? { in: authConfigs.map(c => c.oid) }
                : undefined
            },
            include
          })
      )
    );
  }
}

export let slateAuthConfigEventService = Service.create(
  'slateAuthConfigEventService',
  () => new slateAuthConfigEventServiceImpl()
).build();
