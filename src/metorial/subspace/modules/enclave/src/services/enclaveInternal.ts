import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  addAfterTransactionHook,
  type Enclave,
  type Environment,
  getId,
  Prisma,
  type Provider,
  type ProviderDeployment,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { enclaveCreatedQueue } from '../queues/lifecycle/enclave';
import { networkInternalService } from './networkInternal';

class enclaveInternalServiceImpl {
  private async upsertSystemEnclaveEnvironment(d: { tenant: Tenant }) {
    return withTransaction(
      async db => {
        let systemIdentifier = `system:${d.tenant.id}`;

        let existing = await db.enclaveEnvironment.findFirst({
          where: { systemIdentifier }
        });
        if (existing) return existing;

        return db.enclaveEnvironment.upsert({
          where: { systemIdentifier },
          update: {
            name: `Metorial Platform`,
            type: 'metorial'
          },
          create: {
            ...getId('enclaveEnvironment'),
            name: `Metorial Platform`,
            type: 'metorial',
            systemIdentifier,
            tenantOid: d.tenant.oid
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
  }): Promise<Enclave | null> {
    if (d.providerDeployment.isEphemeral) return null;

    return withTransaction(
      async db => {
        let existing = await db.enclave.findFirst({
          where: { providerDeploymentOid: d.providerDeployment.oid }
        });
        if (existing) return existing;

        let network = await networkInternalService.ensureNetworkForEnvironment({
          tenant: d.tenant,
          environment: d.environment
        });

        let enclaveEnvironment = await this.upsertSystemEnclaveEnvironment({
          tenant: d.tenant
        });

        let enclave = await db.enclave.create({
          data: {
            ...getId('enclave'),
            slug: `${slugify(d.provider.name)}-${generatePlainId(10).toLowerCase()}`,
            name: d.provider.name,
            description: '',
            enclaveEnvironmentOid: enclaveEnvironment.oid,
            providerDeploymentOid: d.providerDeployment.oid,
            networkOid: network.oid,
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
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

export let enclaveInternalService = Service.create(
  'enclaveInternalService',
  () => new enclaveInternalServiceImpl()
).build();
