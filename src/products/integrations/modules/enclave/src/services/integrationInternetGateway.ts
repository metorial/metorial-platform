import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import { type MetorialFacing, resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { integrationInternetGatewayInternalService } from './integrationInternetGatewayInternal';

let include = {
  firewalls: {
    select: {
      id: true,
      slug: true,
      name: true
    }
  },
  enclaves: {
    select: {
      id: true,
      slug: true,
      name: true
    }
  },
  firewallAssignments: {
    include: {
      firewall: {
        select: {
          id: true,
          slug: true,
          name: true
        }
      }
    }
  }
};

export type GetIntegrationInternetGatewayParams = {};

class IntegrationInternetGatewayServiceImpl {
  async get(d: MetorialFacing<GetIntegrationInternetGatewayParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getInternal(d: { tenant: Tenant; environment: Environment }) {
    await integrationInternetGatewayInternalService.ensureInternetGatewayForEnvironment(d);

    return db.integrationInternetGateway.findFirstOrThrow({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include
    });
  }
}

export let integrationInternetGatewayService = Service.create(
  'integrationInternetGatewayService',
  () => new IntegrationInternetGatewayServiceImpl()
).build();
