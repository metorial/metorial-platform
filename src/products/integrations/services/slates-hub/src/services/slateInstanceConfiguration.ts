import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

class slateInstanceConfigurationServiceImpl {
  async upsertSlateInstanceConfiguration(d: {
    tenant: Tenant;
    slateInstanceConfigurationId?: string;
    enclaveId: string;
    egressPolicy: PrismaJson.CompiledEgressNetworkAllowList;
  }) {
    let existing = d.slateInstanceConfigurationId
      ? await db.slateInstanceConfiguration.findFirst({
          where: {
            id: d.slateInstanceConfigurationId,
            tenantOid: d.tenant.oid
          }
        })
      : null;

    if (existing) {
      return db.slateInstanceConfiguration.update({
        where: { oid: existing.oid },
        data: {
          enclaveId: d.enclaveId,
          egressPolicy: d.egressPolicy
        }
      });
    }

    let id = getId('slateInstanceConfiguration');
    let configurationId = d.slateInstanceConfigurationId ?? id.id;

    return db.slateInstanceConfiguration.upsert({
      where: { id: configurationId },
      update: {
        enclaveId: d.enclaveId,
        egressPolicy: d.egressPolicy
      },
      create: {
        ...id,
        id: configurationId,
        tenantOid: d.tenant.oid,
        enclaveId: d.enclaveId,
        egressPolicy: d.egressPolicy
      }
    });
  }

  async getSlateInstanceConfigurationById(d: {
    tenant: Tenant;
    slateInstanceConfigurationId: string;
  }) {
    let configuration = await db.slateInstanceConfiguration.findFirst({
      where: {
        id: d.slateInstanceConfigurationId,
        tenantOid: d.tenant.oid
      }
    });
    if (!configuration) {
      throw new ServiceError(
        notFoundError('slate_instance_configuration', d.slateInstanceConfigurationId)
      );
    }

    return configuration;
  }
}

export let slateInstanceConfigurationService = Service.create(
  'slateInstanceConfigurationService',
  () => new slateInstanceConfigurationServiceImpl()
).build();
