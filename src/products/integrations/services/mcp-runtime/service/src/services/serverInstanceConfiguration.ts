import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

class serverInstanceConfigurationServiceImpl {
  async upsertServerInstanceConfiguration(d: {
    tenant: Tenant;
    serverInstanceConfigurationId?: string;
    enclaveId: string;
    egressPolicy: PrismaJson.CompiledEgressNetworkAllowList;
  }) {
    let existing = d.serverInstanceConfigurationId
      ? await db.serverInstanceConfiguration.findFirst({
          where: {
            id: d.serverInstanceConfigurationId,
            tenantOid: d.tenant.oid
          }
        })
      : null;

    if (existing) {
      return db.serverInstanceConfiguration.update({
        where: { oid: existing.oid },
        data: {
          enclaveId: d.enclaveId,
          egressPolicy: d.egressPolicy
        }
      });
    }

    let id = getId('serverInstanceConfiguration');
    let configurationId = d.serverInstanceConfigurationId ?? id.id;

    return db.serverInstanceConfiguration.upsert({
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

  async getServerInstanceConfigurationById(d: {
    tenant: Tenant;
    serverInstanceConfigurationId: string;
  }) {
    let configuration = await db.serverInstanceConfiguration.findFirst({
      where: {
        id: d.serverInstanceConfigurationId,
        tenantOid: d.tenant.oid
      }
    });
    if (!configuration) {
      throw new ServiceError(
        notFoundError('server_instance_configuration', d.serverInstanceConfigurationId)
      );
    }

    return configuration;
  }
}

export let serverInstanceConfigurationService = Service.create(
  'serverInstanceConfigurationService',
  () => new serverInstanceConfigurationServiceImpl()
).build();
