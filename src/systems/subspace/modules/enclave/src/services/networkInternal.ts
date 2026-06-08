import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Environment,
  getId,
  type Network,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { networkCreatedQueue } from '../queues/lifecycle/network';

let defaultNetworkName = 'Metorial Magic Network';

class networkInternalServiceImpl {
  async ensureNetworkForEnvironment(d: {
    tenant: Tenant;
    environment: Environment;
  }): Promise<Network> {
    return withTransaction(
      async db => {
        let existing = await db.network.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid
          }
        });
        if (existing) return existing;

        let network = await db.network.upsert({
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

        await addAfterTransactionHook(async () =>
          networkCreatedQueue.add({ networkId: network.id })
        );

        return network;
      },
      { ifExists: true }
    );
  }
}

export let networkInternalService = Service.create(
  'networkInternalService',
  () => new networkInternalServiceImpl()
).build();
