import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Environment,
  getId,
  type IntegrationInternetGateway,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { internetGatewayCreatedQueue } from '../queues/lifecycle/internetGateway';

let defaultNetworkName = 'Metorial Magic Network';

class IntegrationInternetGatewayInternalServiceImpl {
  async ensureInternetGatewayForEnvironment(d: {
    tenant: Tenant;
    environment: Environment;
  }): Promise<IntegrationInternetGateway> {
    return withTransaction(
      async db => {
        let existing = await db.integrationInternetGateway.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid
          }
        });
        if (existing) return existing;

        let internetGateway = await db.integrationInternetGateway.upsert({
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
            ...getId('integrationInternetGateway'),
            name: defaultNetworkName,
            tenantOid: d.tenant.oid,
            projectOid: d.tenant.projectOid,
            environmentOid: d.environment.oid,
            instanceOid: d.environment.instanceOid
          }
        });

        await addAfterTransactionHook(async () =>
          internetGatewayCreatedQueue.add({ internetGatewayId: internetGateway.id })
        );

        return internetGateway;
      },
      { ifExists: true }
    );
  }
}

export let integrationInternetGatewayInternalService = Service.create(
  'integrationInternetGatewayInternalService',
  () => new IntegrationInternetGatewayInternalServiceImpl()
).build();
