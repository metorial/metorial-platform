import { UnifiedApiKey } from '@metorial/api-keys';
import { getConfig } from '@metorial/config';
import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Prisma,
  ServerDeployment,
  Session,
  SessionConnectionType,
  SessionStatus
} from '@metorial/db';
import {
  forbiddenError,
  notFoundError,
  ServiceError,
  unauthorizedError
} from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { ingestEventService } from '@metorial/module-event';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  serverDeployments: {
    include: {
      server: true,
      serverVariant: true
    },
    orderBy: { id: 'asc' as const }
  },
  serverSessions: {
    take: 1,
    where: {
      AND: [{ clientInfo: { not: Prisma.DbNull } }, { clientInfo: { not: Prisma.JsonNull } }]
    }
  }

  // serverSessions: {
  //   include: {
  //     serverDeployment: {
  //       include: {
  //         serverVariant: true
  //       }
  //     }
  //   },
  //   orderBy: { id: 'asc' as const }
  // }
};

class SessionImpl {
  private async ensureSessionActive(session: Session) {
    if (session.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted session'
        })
      );
    }
  }

  async createSession(d: {
    instance: Instance;
    organization: Organization;
    performedBy: OrganizationActor;
    input: {
      connectionType: SessionConnectionType;
      serverDeployments: ServerDeployment[];
    };
  }) {
    await Fabric.fire('session.created:before', {
      instance: d.instance,
      organization: d.organization,
      performedBy: d.performedBy
    });

    let session = await db.session.create({
      data: {
        id: await ID.generateId('session'),

        clientSecretId: await ID.generateId('clientSecret'),
        clientSecretValue: UnifiedApiKey.create({
          type: 'ephemeral_client_secret',
          config: { url: getConfig().urls.apiUrl }
        }).toString(),
        clientSecretExpiresAt: null,

        status: 'active',
        connectionStatus: 'disconnected',
        connectionType: d.input.connectionType,

        instanceOid: d.instance.oid,

        serverDeployments: {
          connect: d.input.serverDeployments.map(i => ({
            oid: i.oid
          }))
        }
      },
      include
    });

    await ingestEventService.ingest('session:created', {
      session,
      instance: d.instance,
      performedBy: d.performedBy,
      organization: d.organization
    });

    await Fabric.fire('session.created:after', {
      session,
      instance: d.instance,
      organization: d.organization,
      performedBy: d.performedBy
    });

    return session;
  }

  async getSessionById(d: { instance: Instance; sessionId: string }) {
    let session = await db.session.findFirst({
      where: {
        id: d.sessionId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!session) throw new ServiceError(notFoundError('session'));

    return session;
  }

  async DANGEROUSLY_getSessionOnlyById(d: { sessionId: string }) {
    let session = await db.session.findFirst({
      where: {
        id: d.sessionId
      },
      include: {
        ...include,
        instance: true
      }
    });
    if (!session) throw new ServiceError(notFoundError('session'));

    return session;
  }

  async getSessionByClientSecret(d: { clientSecret: string }) {
    let session = await db.session.findFirst({
      where: {
        clientSecretValue: d.clientSecret,
        OR: [{ clientSecretExpiresAt: { gte: new Date() } }, { clientSecretExpiresAt: null }],
        status: 'active'
      },
      include: {
        ...include,
        instance: { include: { organization: true } }
      }
    });
    if (!session) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid client secret',
          hint: 'Make sure to use a valid client secret and that is has not expired'
        })
      );
    }

    return session;
  }

  async addServerDeployments(d: {
    session: Session;
    performedBy: OrganizationActor;
    organization: Organization;
    instance: Instance;
    serverDeployments: ServerDeployment[];
  }) {
    await this.ensureSessionActive(d.session);

    let session = await db.session.update({
      where: {
        id: d.session.id
      },
      data: {
        serverDeployments: {
          connect: d.serverDeployments.map(i => ({
            oid: i.oid
          }))
        }
      },
      include
    });

    await ingestEventService.ingest('session:updated', {
      session,
      instance: d.instance,
      performedBy: d.performedBy,
      organization: d.organization
    });

    return session;
  }

  async deleteSession(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    session: Session;
  }) {
    await Fabric.fire('session.deleted:before', {
      instance: d.instance,
      organization: d.organization,
      performedBy: d.performedBy,
      session: d.session
    });

    await this.ensureSessionActive(d.session);

    let session = await db.session.update({
      where: {
        id: d.session.id
      },
      data: {
        status: 'deleted',
        deletedAt: new Date()
      },
      include
    });

    await ingestEventService.ingest('session:deleted', {
      session,
      instance: d.instance,
      performedBy: d.performedBy,
      organization: d.organization
    });

    await Fabric.fire('session.deleted:after', {
      session,
      instance: d.instance,
      organization: d.organization,
      performedBy: d.performedBy
    });

    return session;
  }

  async listSessions(d: {
    instance: Instance;

    serverVariantIds?: string[];
    serverImplementationIds?: string[];
    serverDeploymentIds?: string[];
    serverIds?: string[];
    status?: SessionStatus[];
  }) {
    let servers = d.serverIds?.length
      ? await db.server.findMany({
          where: { id: { in: d.serverIds } }
        })
      : undefined;
    let serverVariants = d.serverVariantIds?.length
      ? await db.serverVariant.findMany({
          where: { id: { in: d.serverVariantIds } }
        })
      : undefined;
    let serverImplementations = d.serverImplementationIds?.length
      ? await db.serverImplementation.findMany({
          where: { id: { in: d.serverImplementationIds }, instanceOid: d.instance.oid }
        })
      : undefined;
    let serverDeployments = d.serverDeploymentIds?.length
      ? await db.serverDeployment.findMany({
          where: { id: { in: d.serverDeploymentIds }, instanceOid: d.instance.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.session.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              AND: [
                d.status ? { status: { in: d.status } } : undefined!,

                servers
                  ? {
                      serverDeployments: {
                        some: { serverOid: { in: servers.map(s => s.oid) } }
                      }
                    }
                  : undefined!,
                serverVariants
                  ? {
                      serverDeployments: {
                        some: { serverVariantOid: { in: serverVariants.map(s => s.oid) } }
                      }
                    }
                  : undefined!,
                serverImplementations
                  ? {
                      serverDeployments: {
                        some: {
                          serverImplementationOid: {
                            in: serverImplementations.map(s => s.oid)
                          }
                        }
                      }
                    }
                  : undefined!,
                serverDeployments
                  ? {
                      serverDeployments: {
                        some: { oid: { in: serverDeployments.map(s => s.oid) } }
                      }
                    }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }
}

export let sessionService = Service.create('session', () => new SessionImpl()).build();
