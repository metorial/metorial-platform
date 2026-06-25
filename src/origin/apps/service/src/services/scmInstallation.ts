import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Actor, Tenant } from '../../prisma/generated/client';
import { db } from '../db';

class ScmInstallationServiceImpl {
  async getScmInstallationById(d: { tenant: Tenant; scmInstallationId: string }) {
    let scmInstallation = await db.scmInstallation.findFirst({
      where: {
        id: d.scmInstallationId,
        tenantOid: d.tenant.oid
      },
      include: {
        backend: true
      }
    });
    if (!scmInstallation)
      throw new ServiceError(notFoundError('scm_installation', d.scmInstallationId));

    return scmInstallation;
  }

  async listScmInstallations(d: { tenant: Tenant; actor: Actor }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scmInstallation.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              ownerActorOid: d.actor.oid
            },
            include: {
              backend: true
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
