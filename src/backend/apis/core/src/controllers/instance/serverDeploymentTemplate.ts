import { serverService } from '@metorial/module-catalog';
import { magicMcpServerService } from '@metorial/module-magic';
import { serverDeploymentTemplateService } from '@metorial/module-server-deployment';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverDeploymentTemplatePresenter } from '../../presenters';

export let serverDeploymentTemplateGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.serverDeploymentTemplateId)
    throw new Error('serverDeploymentTemplateId is required');

  let serverDeploymentTemplate =
    await serverDeploymentTemplateService.getServerDeploymentTemplateById({
      serverDeploymentTemplateId: ctx.params.serverDeploymentTemplateId,
      instance: ctx.instance,
      accessTags: ctx.accessTags
    });

  return { serverDeploymentTemplate };
});

export let serverDeploymentTemplateController = Controller.create(
  {
    name: 'Server Deployment Template',
    description: 'Store reusable configuration data for MCP servers in a secure vault.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('server-deployment-template', 'servers.deployments.templates.list'), {
        name: 'List server runs',
        description: 'List all server runs'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.server.deployment:read',
            'consumer#instance.server_template:read'
          ]
        })
      )
      .outputList(serverDeploymentTemplatePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            server_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by server ID(s)' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await serverDeploymentTemplateService.listServerDeploymentTemplates({
          instance: ctx.instance,
          accessTags: ctx.accessTags,

          serverIds: normalizeArrayParam(ctx.query.server_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverDeploymentTemplate =>
          serverDeploymentTemplatePresenter.present({ serverDeploymentTemplate })
        );
      }),

    get: serverDeploymentTemplateGroup
      .get(
        instancePath(
          'server-deployment-template/:serverDeploymentTemplateId',
          'servers.deployments.templates.get'
        ),
        {
          name: 'Get server run',
          description: 'Get the information of a specific server run'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.server.deployment:read',
            'consumer#instance.server_template:read'
          ]
        })
      )
      .output(serverDeploymentTemplatePresenter)
      .do(async ctx => {
        return serverDeploymentTemplatePresenter.present({
          serverDeploymentTemplate: ctx.serverDeploymentTemplate
        });
      }),

    create: instanceGroup
      .post(
        instancePath('server-deployment-template', 'servers.deployments.templates.create'),
        {
          name: 'Create server deployment template',
          description: 'Create a new server deployment template'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .body(
        'default',
        v.intersection([
          v.object({
            name: v.string(),
            description: v.optional(v.string()),
            server_id: v.string()
          }),

          v.union([
            v.object({
              oauth: v.optional(
                v.object({
                  client_id: v.string(),
                  client_secret: v.string()
                })
              ),
              config: v.optional(v.record(v.any()))
            }),
            v.object({
              magic_mcp_server_id: v.string()
            })
          ])
        ])
      )
      .output(serverDeploymentTemplatePresenter)
      .do(async ctx => {
        let server = await serverService.getServerById({
          serverId: ctx.body.server_id,
          organization: ctx.organization
        });

        let serverDeploymentTemplate =
          await serverDeploymentTemplateService.createServerDeploymentTemplate({
            server,
            instance: ctx.instance,
            organization: ctx.organization,
            performedBy: ctx.actor,
            input: {
              name: ctx.body.name,
              description: ctx.body.description,

              from:
                'magic_mcp_server_id' in ctx.body
                  ? {
                      type: 'magic_mcp_server',
                      magicMcpServer: await magicMcpServerService.getMagicMcpServerById({
                        instance: ctx.instance,
                        magicMcpServerId: ctx.body.magic_mcp_server_id
                      })
                    }
                  : {
                      type: 'config',
                      oauth: ctx.body.oauth
                        ? {
                            clientId: ctx.body.oauth.client_id,
                            clientSecret: ctx.body.oauth.client_secret
                          }
                        : undefined,
                      config: ctx.body.config
                    }
            }
          });

        return serverDeploymentTemplatePresenter.present({ serverDeploymentTemplate });
      }),

    update: serverDeploymentTemplateGroup
      .patch(
        instancePath(
          'server-deployment-template/:serverDeploymentTemplateId',
          'servers.deployments.templates.update'
        ),
        {
          name: 'Update server deployment template',
          description: 'Update an existing server deployment template'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          oauth: v.optional(
            v.object({
              client_id: v.string(),
              client_secret: v.string()
            })
          )
        })
      )
      .output(serverDeploymentTemplatePresenter)
      .do(async ctx => {
        let serverDeploymentTemplate =
          await serverDeploymentTemplateService.updateServerDeploymentTemplate({
            serverDeploymentTemplate: ctx.serverDeploymentTemplate,
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              oauth: ctx.body.oauth
                ? {
                    clientId: ctx.body.oauth.client_id,
                    clientSecret: ctx.body.oauth.client_secret
                  }
                : undefined
            }
          });

        return serverDeploymentTemplatePresenter.present({ serverDeploymentTemplate });
      })
  }
);
