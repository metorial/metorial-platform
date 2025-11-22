import { db, ID, Instance, Server, ServerDeploymentTemplate } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
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
  async listServerDeploymentTemplates(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverDeploymentTemplate.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid
            },
            include
          })
      )
    );
  }

  async getServerDeploymentTemplateById(d: {
    instance: Instance;
    serverDeploymentTemplateId: string;
  }) {
    let serverDeploymentTemplate = await db.serverDeploymentTemplate.findFirst({
      where: {
        id: d.serverDeploymentTemplateId,
        instanceOid: d.instance.oid
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
    server: Server;
    input: {
      name: string;
      description?: string;
      oauth?: {
        clientId: string;
        clientSecret: string;
      };
    };
  }) {
    return await db.serverDeploymentTemplate.create({
      data: {
        id: await ID.generateId('serverDeploymentTemplate'),
        name: d.input.name,
        description: d.input.description,

        serverOid: d.server.oid,
        instanceOid: d.instance.oid,

        oauthConfigClientId: d.input.oauth?.clientId,
        oauthConfigClientSecret: d.input.oauth?.clientSecret
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
