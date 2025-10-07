import { UnifiedApiKey } from '@metorial/api-keys';
import { getConfig } from '@metorial/config';
import {
  db,
  ID,
  Instance,
  MagicMcpToken,
  Organization,
  OrganizationActor,
  Prisma,
  Server,
  ServerDeployment,
  ServerImplementation,
  ServerOAuthSession,
  Session,
  SessionConnectionType,
  SessionStatus,
  withTransaction
} from '@metorial/db';
import {
  badRequestError,
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
      serverDeployment: {
        include: {
          server: true,
          serverVariant: true
        }
      },
      oauthSession: true
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

  private async checkServerDeploymentsForSession(d: {
    instance: Instance;
    serverDeployments: {
      deployment: ServerDeployment & {
        server: Server;
        serverImplementation: ServerImplementation;
      };
      oauthSession: ServerOAuthSession | undefined;
    }[];
    ephemeralPermittedDeployments: Set<string>;
  }) {
    for (let serverDeployment of d.serverDeployments) {
      if (
        serverDeployment.deployment.status != 'active' &&
        !d.ephemeralPermittedDeployments.has(serverDeployment.deployment.id)
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot add inactive server deployment to session'
          })
        );
      }

      if (serverDeployment.deployment.oauthConnectionOid && !serverDeployment.oauthSession) {
        throw new ServiceError(
          badRequestError({
            message: 'OAuth session required for server deployments with OAuth connection',
            hint: 'This server deployment requires an OAuth session to be associated with it. Please create an OAuth session first and provide it when creating the session.'
          })
        );
      }

      if (serverDeployment.oauthSession) {
        if (
          serverDeployment.deployment.oauthConnectionOid !=
          serverDeployment.oauthSession.connectionOid
        ) {
          throw new ServiceError(
            badRequestError({
              message:
                "OAuth session does not belong to the server deployment's OAuth connection",
              hint: 'Make sure to create an OAuth session for the connection used by the server deployment'
            })
          );
        }

        if (serverDeployment.oauthSession.status == 'archived') {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot use an archived/deleted OAuth session'
            })
          );
        }

        if (serverDeployment.oauthSession.status != 'completed') {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot use an OAuth session that is not completed',
              hint: 'Make sure the OAuth flow has been completed for the session, i.e., the user has opened the authorization URL and granted access'
            })
          );
        }
      }

      if (serverDeployment.deployment.server.status !== 'active') {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot add server deployment for inactive server'
          })
        );
      }
    }
  }

  async createSession(d: {
    instance: Instance;
    organization: Organization;
    performedBy: OrganizationActor;
    input: {
      connectionType: SessionConnectionType;
      serverDeployments: {
        deployment: ServerDeployment & {
          server: Server;
          serverImplementation: ServerImplementation;
        };
        oauthSession: ServerOAuthSession | undefined;
      }[];
    };
    ephemeralPermittedDeployments: Set<string>;
    magicMcpToken?: MagicMcpToken;
  }) {
    let isMagicMcpSession = false;
    let hasNonMagicServer = false;
    for (let sd of d.input.serverDeployments) {
      if (sd.deployment.isMagicMcpSession) {
        isMagicMcpSession = true;
        d.ephemeralPermittedDeployments.add(sd.deployment.id);
      } else {
        hasNonMagicServer = true;
      }
    }

    if (isMagicMcpSession && hasNonMagicServer) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot mix magic MCP servers with regular server deployments'
        })
      );
    }

    await this.checkServerDeploymentsForSession({
      instance: d.instance,
      serverDeployments: d.input.serverDeployments,
      ephemeralPermittedDeployments: d.ephemeralPermittedDeployments
    });

    await Fabric.fire('session.created:before', {
      instance: d.instance,
      organization: d.organization,
      performedBy: d.performedBy
    });

    let session = await withTransaction(async db => {
      let session = await db.session.create({
        data: {
          id: await ID.generateId('session'),

          clientSecretId: await ID.generateId('clientSecret'),
          clientSecretValue: UnifiedApiKey.create({
            type: 'ephemeral_client_secret',
            config: { url: getConfig().urls.apiUrl }
          }).toString(),
          clientSecretExpiresAt: null,

          // @ts-ignore
          isMagicMcpSession,
          isEphemeral: isMagicMcpSession,

          status: 'active',
          connectionStatus: 'disconnected',
          connectionType: d.input.connectionType,

          instanceOid: d.instance.oid,

          serverDeploymentsOldDontUse: {
            connect: d.input.serverDeployments.map(i => ({
              oid: i.deployment.oid
            }))
          },

          serverDeployments: {
            createMany: {
              data: d.input.serverDeployments.map(i => ({
                id: ID.generateIdSync('sessionServerDeployment'),
                serverDeploymentOid: i.deployment.oid,
                oauthSessionOid: i.oauthSession?.oid ?? null
              }))
            }
          }
        },
        include
      });

      if (isMagicMcpSession) {
        let magicMcpDeployments = await db.magicMcpServerDeployment.findMany({
          where: {
            serverDeploymentOid: {
              in: session.serverDeployments.map(i => i.serverDeployment.oid)
            }
          },
          include: { magicMcpServer: true }
        });
        if (!magicMcpDeployments.length)
          throw new Error('WTF - magic MCP session without deployments');

        let magicMcpServer = magicMcpDeployments[0].magicMcpServer;
        if (magicMcpDeployments.some(d => d.magicMcpServerOid !== magicMcpServer.oid)) {
          throw new ServiceError(
            badRequestError({
              message:
                'Cannot mix deployments from different magic MCP servers in a single session'
            })
          );
        }

        await db.magicMcpSession.create({
          data: {
            id: await ID.generateId('magicMcpSession'),
            instanceOid: d.instance.oid,
            sessionOid: session.oid,
            magicMcpServerOid: magicMcpServer.oid,
            tokenOid: d.magicMcpToken?.oid ?? null
          }
        });
      }

      return session;
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
    serverDeployments: {
      deployment: ServerDeployment & {
        server: Server;
        serverImplementation: ServerImplementation;
      };
      oauthSession: ServerOAuthSession | undefined;
    }[];
    ephemeralPermittedDeployments: Set<string>;
  }) {
    await this.checkServerDeploymentsForSession({
      instance: d.instance,
      serverDeployments: d.serverDeployments,
      ephemeralPermittedDeployments: d.ephemeralPermittedDeployments
    });

    await this.ensureSessionActive(d.session);

    let session = await db.session.update({
      where: {
        id: d.session.id
      },
      data: {
        serverDeploymentsOldDontUse: {
          connect: d.serverDeployments.map(i => ({
            oid: i.deployment.oid
          }))
        },

        serverDeployments: {
          createMany: {
            data: d.serverDeployments.map(i => ({
              id: ID.generateIdSync('sessionServerDeployment'),
              serverDeploymentOid: i.deployment.oid,
              oauthSessionOid: i.oauthSession?.oid ?? null
            }))
          }
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
