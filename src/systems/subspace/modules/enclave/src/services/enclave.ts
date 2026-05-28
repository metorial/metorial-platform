import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Enclave,
  type Environment,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { resolveProviderDeployments } from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';

let include = {
  enclaveEnvironment: true,
  providerDeployment: {
    select: {
      id: true
    }
  }
};

class enclaveServiceImpl {
  async listEnclaves(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids?: string[];
    providerDeploymentIds?: string[];
  }) {
    let providerDeployments = await resolveProviderDeployments(d, d.providerDeploymentIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.enclave.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              providerDeployments ? { providerDeploymentOid: providerDeployments.in } : undefined!
            ].filter(Boolean)
          },
          include
        })
      )
    );
  }

  async getEnclaveById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    enclaveId: string;
  }) {
    let enclave = await db.enclave.findFirst({
      where: {
        id: d.enclaveId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!enclave) {
      throw new ServiceError(notFoundError('enclave', d.enclaveId));
    }

    return enclave;
  }

  async updateEnclave(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    enclave: Enclave;
    input: {
      name?: string;
      description?: string;
    };
  }) {
    checkTenant(d, d.enclave);

    return withTransaction(async db =>
      db.enclave.update({
        where: {
          oid: d.enclave.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.enclave.name,
          description: d.input.description ?? d.enclave.description
        },
        include
      })
    );
  }
}

export let enclaveService = Service.create('enclaveService', () => new enclaveServiceImpl()).build();
