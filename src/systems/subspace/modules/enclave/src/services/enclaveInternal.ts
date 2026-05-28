import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  type Enclave,
  type Environment,
  getId,
  type Provider,
  type ProviderDeployment,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { networkInternalService } from './networkInternal';

class enclaveInternalServiceImpl {
  private async upsertSystemEnclaveEnvironment(d: {
    tenant: Tenant;
    db: Parameters<Parameters<typeof withTransaction>[0]>[0];
  }) {
    let systemIdentifier = `system:${d.tenant.id}`;

    let existing = await d.db.enclaveEnvironment.findFirst({
      where: { systemIdentifier }
    });
    if (existing) return existing;

    return d.db.enclaveEnvironment.upsert({
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
  }

  async ensureEnclaveForProviderDeployment(d: {
    tenant: Tenant;
    solution: Solution;
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
          environment: d.environment,
          db
        });

        let enclaveEnvironment = await this.upsertSystemEnclaveEnvironment({
          tenant: d.tenant,
          db
        });

        return db.enclave.create({
          data: {
            ...getId('enclave'),
            slug: `${slugify(d.provider.name)}-${generatePlainId(10).toLowerCase()}`,
            name: d.provider.name,
            description: '',
            enclaveEnvironmentOid: enclaveEnvironment.oid,
            providerDeploymentOid: d.providerDeployment.oid,
            networkOid: network.oid,
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid
          }
        });
      },
      { ifExists: true }
    );
  }
}

export let enclaveInternalService = Service.create(
  'enclaveInternalService',
  () => new enclaveInternalServiceImpl()
).build();
