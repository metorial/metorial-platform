import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type {
  Slate,
  SlateInstance,
  SlateVersion,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

let include = {
  slate: true,
  slateInstance: true,
  slateVersion: true
};

class slateSessionServiceImpl {
  async createSlateSession(d: {
    tenant: Tenant;
    input: {
      slateInstance: SlateInstance;
      slate: Slate;
      lockedVersion?: SlateVersion;
    };
  }) {
    let version =
      d.input.lockedVersion ??
      (await this.getSessionVersion({
        slate: d.input.slate,
        slateInstance: d.input.slateInstance
      }));

    return await db.slateSession.create({
      data: {
        ...getId('slateSession'),

        tenantOid: d.tenant.oid,
        slateOid: d.input.slate.oid,
        slateVersionOid: version.oid,
        slateInstanceOid: d.input.slateInstance.oid
      },
      include
    });
  }

  async getSlateSessionById(d: { tenant: Tenant; id: string }) {
    let slateSession = await db.slateSession.findFirst({
      where: {
        slateInstance: { tenantOid: d.tenant.oid },
        id: d.id
      },
      include
    });
    if (!slateSession) throw new ServiceError(notFoundError('slate.session'));
    return slateSession;
  }

  async listSlateSessions(d: {
    tenant: Tenant;
    slateIds?: string[];
    slateInstanceIds?: string[];
    slateVersionIds?: string[];
    toolIds?: string[];
  }) {
    let slateInstances = d.slateInstanceIds
      ? await db.slateInstance.findMany({
          where: { id: { in: d.slateInstanceIds }, tenantOid: d.tenant.oid }
        })
      : undefined;
    let slates = d.slateIds
      ? await db.slate.findMany({
          where: { id: { in: d.slateIds } }
        })
      : undefined;
    let slateVersions = d.slateVersionIds
      ? await db.slateVersion.findMany({
          where: { id: { in: d.slateVersionIds } }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateSession.findMany({
            ...opts,
            where: {
              slateInstance: { tenantOid: d.tenant.oid },

              AND: [
                ...(slateVersions
                  ? [
                      {
                        OR: [
                          { slateVersionOid: { in: slateVersions.map(sv => sv.oid) } },
                          {
                            toolCalls: {
                              some: { slateVersionOid: { in: slateVersions.map(sv => sv.oid) } }
                            }
                          }
                        ]
                      }
                    ]
                  : []),

                ...(slateInstances
                  ? [{ slateInstanceOid: { in: slateInstances.map(si => si.oid) } }]
                  : []),

                ...(slates
                  ? [{ slateVersion: { slateOid: { in: slates.map(s => s.oid) } } }]
                  : [])
              ]
            },
            include
          })
      )
    );
  }

  async getSessionVersion(d: { slate: Slate; slateInstance: SlateInstance }) {
    if (!d.slate.currentVersionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider does not have a current version set.'
        })
      );
    }

    let fullVersion = await db.slateVersion.findFirstOrThrow({
      where: {
        slateOid: d.slate.oid,
        oid: d.slateInstance.lockedSlateVersionOid ?? d.slate.currentVersionOid
      },
      include: { specification: true }
    });
    if (fullVersion.status !== 'active' || !fullVersion.activeDeploymentOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider version has not been deployed yet.'
        })
      );
    }

    return fullVersion;
  }

  async getManySlateSessionsByIds(d: { ids: string[]; tenant: Tenant }) {
    return db.slateSession.findMany({
      where: {
        slateInstance: { tenantOid: d.tenant.oid },
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slateSessionService = Service.create(
  'slateSessionService',
  () => new slateSessionServiceImpl()
).build();
