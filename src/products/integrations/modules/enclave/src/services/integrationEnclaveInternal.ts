import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  addAfterTransactionHook,
  type IntegrationEnclave,
  type Environment,
  getId,
  Prisma,
  type Provider,
  type ProviderDeployment,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { enclaveCreatedQueue } from '../queues/lifecycle/enclave';
import { integrationInternetGatewayInternalService } from './integrationInternetGatewayInternal';

class IntegrationEnclaveInternalServiceImpl {
  private async upsertSystemEnclaveEnvironment(d: { tenant: Tenant }) {
    return withTransaction(
      async db => {
        let systemIdentifier = `system:${d.tenant.id}`;

        let existing = await db.integrationEnclaveEnvironment.findFirst({
          where: { systemIdentifier }
        });
        if (existing) return existing;

        return db.integrationEnclaveEnvironment.upsert({
          where: { systemIdentifier },
          update: {
            name: `Metorial Platform`,
            type: 'metorial'
          },
          create: {
            ...getId('integrationEnclaveEnvironment'),
            name: `Metorial Platform`,
            type: 'metorial',
            systemIdentifier,
            tenantOid: d.tenant.oid,
            projectOid: d.tenant.projectOid
          }
        });
      },
      { ifExists: true }
    );
  }

  async ensureEnclaveForProviderDeployment(d: {
    tenant: Tenant;
    environment: Environment;
    provider: Provider;
    providerDeployment: ProviderDeployment;
  }): Promise<IntegrationEnclave | null> {
    if (d.providerDeployment.isEphemeral) return null;

    return withTransaction(
      async db => {
        let existing = await db.integrationEnclave.findFirst({
          where: { providerDeploymentOid: d.providerDeployment.oid }
        });
        if (existing) return existing;

        let internetGateway =
          await integrationInternetGatewayInternalService.ensureInternetGatewayForEnvironment({
            tenant: d.tenant,
            environment: d.environment
          });

        let enclaveEnvironment = await this.upsertSystemEnclaveEnvironment({
          tenant: d.tenant
        });

        let enclave = await db.integrationEnclave.create({
          data: {
            ...getId('integrationEnclave'),
            slug: `${slugify(d.provider.name)}-${generatePlainId(10).toLowerCase()}`,
            name: d.provider.name,
            description: '',
            enclaveEnvironmentOid: enclaveEnvironment.oid,
            providerDeploymentOid: d.providerDeployment.oid,
            internetGatewayOid: internetGateway.oid,
            tenantOid: d.tenant.oid,
            projectOid: d.tenant.projectOid,
            environmentOid: d.environment.oid,
            instanceOid: d.environment.instanceOid,
            compiledNetworkRules: Prisma.JsonNull,
            needsEnclaveReconciliation: true
          }
        });

        await addAfterTransactionHook(async () =>
          enclaveCreatedQueue.add({ enclaveId: enclave.id })
        );

        return enclave;
      },
      { ifExists: true }
    );
  }
}

export let integrationEnclaveInternalService = Service.create(
  'integrationEnclaveInternalService',
  () => new IntegrationEnclaveInternalServiceImpl()
).build();
