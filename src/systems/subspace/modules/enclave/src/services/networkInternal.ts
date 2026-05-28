import { Service } from '@lowerdeck/service';
import {
  type Environment,
  getId,
  type Network,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';

let defaultNetworkName = 'Metorial Magic Network';

class networkInternalServiceImpl {
  async ensureNetworkForEnvironment(d: {
    tenant: Tenant;
    environment: Environment;
  }): Promise<Network> {
    return withTransaction(async db => {
      let existing = await db.network.findFirst({
        where: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });
      if (existing) return existing;

      return db.network.upsert({
        where: {
          tenantOid_environmentOid: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid
          }
        },
        update: {
          name: defaultNetworkName
        },
        create: {
          ...getId('network'),
          name: defaultNetworkName,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });
    }, { ifExists: true });
  }
}

export let networkInternalService = Service.create(
  'networkInternalService',
  () => new networkInternalServiceImpl()
).build();
