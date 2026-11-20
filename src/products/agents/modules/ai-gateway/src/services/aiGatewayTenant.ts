import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Instance } from '@metorial/db';
import { getAiGateway } from '../lib/client';
import { upsertInstanceScope } from '../lib/scope';

class AiGatewayTenantServiceImpl {
  async ensure(d: { instance: Instance }) {
    let gateway = getAiGateway();
    if (!gateway) {
      throw new ServiceError(
        preconditionFailedError({ message: 'The AI gateway is not configured.' })
      );
    }

    let instance = await db.instance.findUniqueOrThrow({
      where: { oid: d.instance.oid },
      include: { organization: true, project: true }
    });

    return await upsertInstanceScope({
      gateway,
      organization: instance.organization,
      project: instance.project,
      instance
    });
  }
}

export let aiGatewayTenantService = Service.create(
  'aiGatewayTenantService',
  () => new AiGatewayTenantServiceImpl()
).build();
