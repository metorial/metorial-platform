import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Server,
  ServerDeploymentTemplate
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { AccessTagSelectorList, accessTagService } from '@metorial/module-access';
import { secretService } from '@metorial/module-secret';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  server: {
    include: {
      importedServer: true,

      variants: {
        include: {
          currentVersion: {
            include: {
              schema: true
            }
          }
        }
      }
    }
  }
};

class serverDeploymentTemplateServiceImpl {
  async listServerDeploymentTemplates(d: {
    instance: Instance;
    accessTags?: AccessTagSelectorList;
    serverIds?: string[];
  }) {
    let servers = d.serverIds
      ? await db.server.findMany({
          where: { id: { in: d.serverIds } },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverDeploymentTemplate.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              accessTags: await accessTagService.getAccessTagFilter({
                tags: d.accessTags,
                level: 'read'
              }),

              serverOid: servers ? { in: servers.map(s => s.oid) } : undefined
            },
            include
          })
      )
    );
  }

  async getServerDeploymentTemplateById(d: {
    instance: Instance;
    serverDeploymentTemplateId: string;
    accessTags?: AccessTagSelectorList;
  }) {
    let serverDeploymentTemplate = await db.serverDeploymentTemplate.findFirst({
      where: {
        id: d.serverDeploymentTemplateId,
        instanceOid: d.instance.oid,

        accessTags: await accessTagService.getAccessTagFilter({
          tags: d.accessTags,
          level: 'read'
        })
      },
      include
    });
    if (!serverDeploymentTemplate)
      throw new ServiceError(
        notFoundError('server.server_deployment.template', d.serverDeploymentTemplateId)
      );

    return serverDeploymentTemplate;
  }

  async createServerDeploymentTemplate(d: {
    instance: Instance;
    organization: Organization;
    performedBy: OrganizationActor;
    server: Server;
    input: {
      name: string;
      description?: string;

      from:
        | {
            type: 'config';
            oauth?: {
              clientId: string;
              clientSecret: string;
            };
            config?: Record<string, any>;
          };
    };
  }) {
    let config: Record<string, any> | undefined;
    let oauthData:
      | { clientId: string | undefined; clientSecret: string | undefined }
      | undefined;

    if (d.input.from.type === 'config') {
      config = d.input.from.config;
      oauthData = d.input.from.oauth;
    }

    let configSecret = config
      ? await secretService.createSecret({
          instance: d.instance,
          organization: d.organization,
          performedBy: d.performedBy,
          input: {
            type: 'server_deployment_template_config',
            secretData: config
          }
        })
      : undefined;

    return await db.serverDeploymentTemplate.create({
      data: {
        id: await ID.generateId('serverDeploymentTemplate'),
        name: d.input.name,
        description: d.input.description,

        serverOid: d.server.oid,
        instanceOid: d.instance.oid,

        oauthConfigClientId: oauthData?.clientId,
        oauthConfigClientSecret: oauthData?.clientSecret,

        configSecretOid: configSecret?.oid
      },
      include
    });
  }

  async updateServerDeploymentTemplate(d: {
    serverDeploymentTemplate: ServerDeploymentTemplate;
    input: {
      name?: string;
      description?: string;
      oauth?: {
        clientId: string;
        clientSecret: string;
      };
    };
  }) {
    return await db.serverDeploymentTemplate.update({
      where: {
        oid: d.serverDeploymentTemplate.oid
      },
      data: {
        name: d.input.name,
        description: d.input.description,

        oauthConfigClientId: d.input.oauth?.clientId,
        oauthConfigClientSecret: d.input.oauth?.clientSecret
      },
      include
    });
  }
}

export let serverDeploymentTemplateService = Service.create(
  'serverDeploymentTemplate',
  () => new serverDeploymentTemplateServiceImpl()
).build();
