import { db, Organization, OrganizationActor } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

class ScmInstallationServiceImpl {
  async getScmInstallationById(d: { organization: Organization; scmInstallationId: string }) {
    let scmInstallation = await db.scmInstallation.findFirst({
      where: {
        id: d.scmInstallationId,
        organizationOid: d.organization.oid
      }
    });
    if (!scmInstallation)
      throw new ServiceError(notFoundError('server_deployment', d.scmInstallationId));

    return scmInstallation;
  }

  async listScmInstallations(d: { organization: Organization; actor: OrganizationActor }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scmInstallation.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              ownerActorOid: d.actor.oid
            }
          })
      )
    );
  }
}

export let scmInstallationService = Service.create(
  'scmInstallation',
  () => new ScmInstallationServiceImpl()
).build();
