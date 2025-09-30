import { CustomServer, db } from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  customServer: true,
  customServerVersion: true,
  steps: true,
  creatorActor: {
    include: {
      organization: true
    }
  }
};

class CustomServerDeploymentServiceImpl {
  async listCustomServerDeployments(d: { server: CustomServer; versionIds?: string[] }) {
    let versionIdsUnique = d.versionIds ? [...new Set(d.versionIds)] : [];
    let versionOids = d.versionIds
      ? await db.customServerVersion
          .findMany({
            where: { id: { in: versionIdsUnique } },
            select: { oid: true }
          })
          .then(r => r.map(v => v.oid))
      : undefined;

    if (d.versionIds && (!versionOids || versionIdsUnique.length !== versionOids.length)) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid version IDs provided'
        })
      );
    }

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customServerDeployment.findMany({
            ...opts,
            where: {
              customServerOid: d.server.oid,
              customServerVersion: versionOids ? { oid: { in: versionOids } } : undefined
            },
            include
          })
      )
    );
  }

  async getCustomServerDeploymentById(d: { server: CustomServer; deploymentId: string }) {
    let server = await db.customServerDeployment.findFirst({
      where: {
        id: d.deploymentId,
        customServerOid: d.server.oid
      },
      include
    });
    if (!server) {
      throw new ServiceError(notFoundError('server_deployment', d.deploymentId));
    }

    return server;
  }
}

export let customServerDeploymentService = Service.create(
  'customServerDeployment',
  () => new CustomServerDeploymentServiceImpl()
).build();
