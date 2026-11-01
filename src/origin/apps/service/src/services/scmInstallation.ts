import { getAllowedScmBackendIds } from '../lib/scmPolicy';
import { assertScmBackendAllowed } from '../lib/scmPolicy';
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

    assertScmBackendAllowed(scmInstallation.backend);

    return scmInstallation;
  }

  async listScmInstallations(d: { tenant: Tenant; actor: Actor }) {
    let allowed = await getAllowedScmBackendIds(d.tenant.oid);
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scmInstallation.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              ownerActorOid: d.actor.oid,
              backendOid: allowed ? { in: allowed } : undefined
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
