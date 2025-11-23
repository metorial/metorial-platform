import {
  ConsumerAccess,
  ConsumerAccessType,
  ConsumerGroup,
  ConsumerSurface,
  db,
  ID,
  MagicMcpGroup,
  ServerDeploymentTemplate,
  withTransaction
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Paginator } from '../../../../../packages/server/pagination/src';

let include = {
  magicMcpGroup: true,
  consumerGroup: true,
  serverDeploymentTemplate: {
    include: {
      server: true
    }
  }
};

class consumerAccessServiceImpl {
  async listConsumerAccesses(d: {
    consumerSurface: ConsumerSurface;
    consumerGroupIds?: string[];
    magicMcpGroupIds?: string[];
    serverDeploymentTemplateIds?: string[];
    types?: ConsumerAccessType[];
  }) {
    let consumerGroups = d.consumerGroupIds
      ? await db.consumerGroup.findMany({
          where: {
            id: { in: d.consumerGroupIds },
            surfaceOid: d.consumerSurface.oid
          }
        })
      : [];
    let magicMcpGroups = d.magicMcpGroupIds
      ? await db.magicMcpGroup.findMany({
          where: {
            id: { in: d.magicMcpGroupIds }
          }
        })
      : [];
    let serverDeploymentTemplates = d.serverDeploymentTemplateIds
      ? await db.serverDeploymentTemplate.findMany({
          where: {
            id: { in: d.serverDeploymentTemplateIds }
          }
        })
      : [];

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.consumerAccess.findMany({
            ...opts,
            where: {
              surfaceOid: d.consumerSurface.oid,

              type: d.types ? { in: d.types } : undefined,

              magicMcpGroupOid: magicMcpGroups.length
                ? { in: magicMcpGroups.map(g => g.oid) }
                : undefined,
              consumerGroupOid: consumerGroups.length
                ? { in: consumerGroups.map(g => g.oid) }
                : undefined,
              serverDeploymentTemplateOid: serverDeploymentTemplates.length
                ? { in: serverDeploymentTemplates.map(g => g.oid) }
                : undefined
            },
            include
          })
      )
    );
  }

  async getConsumerAccessById(d: { consumerSurface: ConsumerSurface; accessId: string }) {
    let consumerSurface = await db.consumerAccess.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        OR: [
          { id: d.accessId },
          { magicMcpGroup: { id: d.accessId } },
          { consumerGroup: { id: d.accessId } }
        ]
      },
      include
    });
    if (!consumerSurface)
      throw new ServiceError(notFoundError('consumer.surface.magic_mcp_access'));
    return consumerSurface;
  }

  async createConsumerAccess(d: {
    consumerSurface: ConsumerSurface;
    consumerGroup: ConsumerGroup;

    access:
      | {
          type: 'magic_mcp_group';
          magicMcpGroup: MagicMcpGroup;
        }
      | {
          type: 'server_deployment_template';
          serverDeploymentTemplate: ServerDeploymentTemplate;
        };
  }) {
    return await withTransaction(async db => {
      let id = await ID.generateId('consumerAccess');
      let access = await db.consumerAccess.upsert({
        where:
          d.access.type === 'magic_mcp_group'
            ? {
                consumerGroupOid_magicMcpGroupOid: {
                  consumerGroupOid: d.consumerGroup.oid,
                  magicMcpGroupOid: d.access.magicMcpGroup.oid
                }
              }
            : {
                consumerGroupOid_serverDeploymentTemplateOid: {
                  consumerGroupOid: d.consumerGroup.oid,
                  serverDeploymentTemplateOid: d.access.serverDeploymentTemplate.oid
                }
              },
        create: {
          id,
          surfaceOid: d.consumerSurface.oid,
          consumerGroupOid: d.consumerGroup.oid,

          type: d.access.type,
          magicMcpGroupOid:
            d.access.type === 'magic_mcp_group' ? d.access.magicMcpGroup.oid : undefined,
          serverDeploymentTemplateOid:
            d.access.type === 'server_deployment_template'
              ? d.access.serverDeploymentTemplate.oid
              : undefined
        },
        update: {},
        include
      });

      // Make sure we're the creators
      if (access.id == id) {
        if (d.access.type === 'magic_mcp_group') {
          await db.accessTagEntity.create({
            data: {
              level: 'read',
              accessTagOid: d.consumerGroup.accessTagOid,
              magicMcpGroupOid: d.access.magicMcpGroup.oid
            }
          });
        }

        if (d.access.type === 'server_deployment_template') {
          await db.accessTagEntity.create({
            data: {
              level: 'read',
              accessTagOid: d.consumerGroup.accessTagOid,
              serverDeploymentTemplateOid: d.access.serverDeploymentTemplate.oid
            }
          });
        }
      }

      return access;
    });
  }

  async deleteConsumerAccess(d: { groupAccess: ConsumerAccess }) {
    return await withTransaction(async db => {
      let access = await db.consumerAccess.delete({
        where: {
          oid: d.groupAccess.oid
        },
        include
      });

      if (d.groupAccess.type == 'magic_mcp_group') {
        await db.accessTagEntity.deleteMany({
          where: {
            accessTagOid: access.consumerGroup.accessTagOid,
            magicMcpGroupOid: d.groupAccess.magicMcpGroupOid!
          }
        });
      }

      if (d.groupAccess.type == 'server_deployment_template') {
        await db.accessTagEntity.deleteMany({
          where: {
            accessTagOid: access.consumerGroup.accessTagOid,
            serverDeploymentTemplateOid: d.groupAccess.serverDeploymentTemplateOid!
          }
        });
      }
    });
  }
}

export let consumerAccessService = Service.create(
  'consumerAccessService',
  () => new consumerAccessServiceImpl()
).build();
