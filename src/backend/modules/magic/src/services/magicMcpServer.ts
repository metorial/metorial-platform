import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  db,
  ID,
  Instance,
  MagicMcpServer,
  MagicMcpServerAlias,
  MagicMcpServerStatus,
  Organization,
  OrganizationActor,
  ServerDeployment,
  ServerOAuthSession,
  withTransaction
} from '@metorial/db';
import { notFoundError, preconditionFailedError, ServiceError } from '@metorial/error';
import { generateCode } from '@metorial/id';
import { AccessTagSelectorList, accessTagService } from '@metorial/module-access';
import { searchService } from '@metorial/module-search';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { slugify } from '@metorial/slugify';
import { syncMagicMcpServerQueue } from '../queues/syncServer';

let include = {
  serverDeployment: {
    include: {
      serverDeployment: {
        include: {
          server: true,
          serverImplementation: true
        }
      }
    }
  },
  defaultServerOauthSession: true,
  aliases: true
};

class MagicMcpServerImpl {
  async privateGetAccessTagFilterForReadAccess(d: { accessTags?: AccessTagSelectorList }) {
    return {
      OR: [
        {
          accessTags: await accessTagService.getAccessTagFilter({
            tags: d.accessTags,
            level: 'read'
          })
        },

        {
          groups: {
            some: {
              magicMcpGroup: {
                accessTags: await accessTagService.getAccessTagFilter({
                  tags: d.accessTags,
                  level: 'read'
                })
              }
            }
          }
        }
      ]
    };
  }

  async getMagicMcpServerById(d: {
    accessTags?: AccessTagSelectorList;
    instance: Instance;
    magicMcpServerId: string;
  }) {
    let magicMcpServer = await db.magicMcpServer.findFirst({
      where: {
        instanceOid: d.instance.oid,

        AND: [
          {
            OR: [
              { id: d.magicMcpServerId },
              {
                aliases: {
                  some: { slug: d.magicMcpServerId }
                }
              }
            ]
          },

          d.accessTags
            ? await this.privateGetAccessTagFilterForReadAccess({ accessTags: d.accessTags })
            : undefined!
        ].filter(Boolean)
      },
      include
    });
    if (!magicMcpServer) throw new ServiceError(notFoundError('magic_mcp.server'));

    return magicMcpServer;
  }

  async DANGEROUSLY_getMagicMcpServerOnlyById(d: { magicMcpServerId: string }) {
    let magicMcpServer = await db.magicMcpServer.findFirst({
      where: {
        OR: [
          { id: d.magicMcpServerId },
          {
            aliases: {
              some: { slug: d.magicMcpServerId }
            }
          }
        ]
      },
      include: {
        ...include,
        instance: true
      }
    });
    if (!magicMcpServer) throw new ServiceError(notFoundError('magic_mcp.server'));

    return magicMcpServer;
  }

  async getManyMagicMcpServers(d: { magicMcpServerId: string[]; instance: Instance }) {
    if (d.magicMcpServerId.length === 0) return [];

    return await db.magicMcpServer.findMany({
      where: {
        id: { in: d.magicMcpServerId },
        instanceOid: d.instance.oid
      },
      include
    });
  }

  async createMagicMcpServer(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context: Context;

    consumer?: {
      profile: ConsumerProfile;
    };

    serverDeployment: ServerDeployment;

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    let slug = await slugify(`${d.input.name}-${generateCode(5)}`);

    return withTransaction(async db => {
      let server = await db.magicMcpServer.create({
        data: {
          id: await ID.generateId('magicMcpServer'),
          status: 'active',
          serverDeployment: {
            create: {
              id: await ID.generateId('magicMcpServerDeployment'),
              serverDeploymentOid: d.serverDeployment.oid
            }
          },
          instanceOid: d.instance.oid,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata || {},
          aliases: {
            create: { slug }
          },

          consumerProfileOid: d.consumer?.profile.oid,
          accessTags: d.consumer
            ? await accessTagService.linkAccessTagToEntity({
                tags: d.consumer.profile.accessTagOid,
                level: 'read_write'
              })
            : undefined
        },
        include
      });

      await syncMagicMcpServerQueue.add({
        magicMcpServerId: server.id
      });

      return server;
    });
  }

  async checkWriteAccess(d: { server: MagicMcpServer; accessTags?: AccessTagSelectorList }) {
    await accessTagService.checkResourceAccess({
      tags: d.accessTags,
      level: 'read_write',
      checker: async filter =>
        await db.magicMcpServer.findFirst({
          where: {
            oid: d.server.oid,
            accessTags: filter
          },
          select: { oid: true }
        })
    });
  }

  async archiveMagicMcpServer(d: {
    server: MagicMcpServer;
    accessTags?: AccessTagSelectorList;
  }) {
    await this.checkWriteAccess({ server: d.server, accessTags: d.accessTags });

    if (d.server.status === 'archived') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The server magic MCP server is already archived'
        })
      );
    }

    return await db.magicMcpServer.update({
      where: { id: d.server.id },
      data: { status: 'archived', deletedAt: new Date() },
      include
    });
  }

  async updateMagicMcpServer(d: {
    server: MagicMcpServer & { aliases: MagicMcpServerAlias[] };
    accessTags?: AccessTagSelectorList;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, any> | null;
      aliases?: string[];
      defaultOauthSession?: ServerOAuthSession;
    };
  }) {
    await this.checkWriteAccess({ server: d.server, accessTags: d.accessTags });

    if (d.server.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a magic MCP server that is not active'
        })
      );
    }

    let existingAliases = d.server.aliases.map(a => a.slug);
    let newAliases = (d.input.aliases ?? [])?.filter(s => !existingAliases.includes(s));

    let server = await db.magicMcpServer.update({
      where: { id: d.server.id },
      data: {
        name: d.input.name === undefined ? d.server.name : d.input.name,
        description:
          d.input.description === undefined ? d.server.description : d.input.description,
        metadata: d.input.metadata === undefined ? d.server.metadata : d.input.metadata,

        defaultServerOauthSessionOid: d.input.defaultOauthSession?.oid,

        aliases: {
          create: newAliases.map(slug => ({
            slug: slug.includes(' ') ? slugify(slug) : slug
          }))
        }
      },
      include
    });

    await syncMagicMcpServerQueue.add({
      magicMcpServerId: server.id
    });

    return server;
  }

  async listMagicMcpServers(d: {
    serverVariantIds?: string[];
    serverImplementationIds?: string[];
    serverIds?: string[];
    sessionIds?: string[];
    groupIds?: string[];
    consumerGroupIds?: string[];
    portalIds?: string[];
    search?: string;
    instance: Instance;
    status?: MagicMcpServerStatus[];
    accessTags?: AccessTagSelectorList;
  }) {
    let search = d.search
      ? await searchService.search<{ id: string }>({
          index: 'magic_mcp_server',
          query: d.search,
          options: {
            filters: {
              instanceId: { $eq: d.instance.id }
            },
            limit: 50
          }
        })
      : undefined;

    let servers = d.serverIds?.length
      ? await db.server.findMany({
          where: { id: { in: d.serverIds } },
          select: { oid: true }
        })
      : undefined;
    let serverVariants = d.serverVariantIds?.length
      ? await db.serverVariant.findMany({
          where: { id: { in: d.serverVariantIds } },
          select: { oid: true }
        })
      : undefined;
    let serverImplementations = d.serverImplementationIds?.length
      ? await db.serverImplementation.findMany({
          where: { id: { in: d.serverImplementationIds } },
          select: { oid: true }
        })
      : undefined;
    let sessions = d.sessionIds?.length
      ? await db.session.findMany({
          where: { id: { in: d.sessionIds } },
          select: { oid: true }
        })
      : undefined;
    let groups = d.groupIds?.length
      ? await db.magicMcpGroup.findMany({
          where: { id: { in: d.groupIds } },
          select: { oid: true }
        })
      : undefined;
    let consumerGroups = d.consumerGroupIds?.length
      ? await db.consumerGroup.findMany({
          where: { id: { in: d.consumerGroupIds } },
          select: { oid: true }
        })
      : undefined;
    let portals = d.portalIds?.length
      ? await db.portal.findMany({
          where: { id: { in: d.portalIds } },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await await db.magicMcpServer.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,

            AND: [
              d.status
                ? { status: { in: d.status } }
                : { status: { not: 'archived' as const } },

              groups
                ? {
                    groups: {
                      some: {
                        magicMcpGroupOid: { in: groups.map(g => g.oid) }
                      }
                    }
                  }
                : undefined!,

              consumerGroups
                ? {
                    groups: {
                      some: {
                        magicMcpGroup: {
                          consumerAccesses: {
                            some: {
                              consumerGroupOid: { in: consumerGroups.map(g => g.oid) }
                            }
                          }
                        }
                      }
                    }
                  }
                : undefined!,

              portals
                ? {
                    groups: {
                      some: {
                        magicMcpGroup: {
                          consumerAccesses: {
                            some: {
                              consumerGroup: {
                                surface: {
                                  portals: {
                                    some: {
                                      oid: { in: portals.map(p => p.oid) }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                : undefined!,

              d.accessTags
                ? await this.privateGetAccessTagFilterForReadAccess({
                    accessTags: d.accessTags
                  })
                : undefined!
            ].filter(Boolean),

            serverDeployment: {
              serverDeployment: {
                serverOid: servers ? { in: servers.map(s => s.oid) } : undefined,
                serverImplementationOid: serverImplementations
                  ? { in: serverImplementations.map(s => s.oid) }
                  : undefined,
                serverImplementation: serverVariants
                  ? { serverVariantOid: { in: serverVariants.map(s => s.oid) } }
                  : undefined,

                sessionsOldDontUse: sessions
                  ? {
                      some: {
                        oid: { in: sessions.map(s => s.oid) }
                      }
                    }
                  : undefined
              }
            },

            id: search ? { in: search.map(s => s.id) } : undefined
          },
          include
        });

        return res;
      })
    );
  }
}

export let magicMcpServerService = Service.create(
  'magicMcpServer',
  () => new MagicMcpServerImpl()
).build();
