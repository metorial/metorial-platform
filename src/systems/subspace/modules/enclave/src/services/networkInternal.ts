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
    db?: Parameters<Parameters<typeof withTransaction>[0]>[0];
  }): Promise<Network> {
    let run = async (db: Parameters<Parameters<typeof withTransaction>[0]>[0]) => {
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
    };

    if (d.db) return run(d.db);

    return withTransaction(run, { ifExists: true });
  }
}

export let networkInternalService = Service.create(
  'networkInternalService',
  () => new networkInternalServiceImpl()
).build();
