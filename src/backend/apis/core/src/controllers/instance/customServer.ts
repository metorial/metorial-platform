import { forbiddenError, ServiceError } from '@metorial/error';
import { serverListingService } from '@metorial/module-catalog';
import {
  customServerService,
  managedServerTemplateService
} from '@metorial/module-custom-server';
import { flagService } from '@metorial/module-flags';
import { scmRepoService } from '@metorial/module-scm';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { normalizePath } from '../../lib/normalizePath';
import { switcher } from '../../lib/switcher';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { customServerPresenter, serverListingPresenter } from '../../presenters';

export let customServerGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.customServerId) throw new Error('customServerId is required');

  let customServer = await customServerService.getCustomServerById({
    serverId: ctx.params.customServerId,
    instance: ctx.instance
  });

  return { customServer };
});

let customServerTypeEnum = v.enumOf(['remote', 'managed', 'docker']);

export let customServerController = Controller.create(
  {
    name: 'Custom Server',
    description: 'Manager custom servers',
    deprecated: true
  },
  {
    list: instanceGroup
      .get(instancePath('custom-servers', 'custom_servers.list'), {
        name: 'List custom servers',
        description: 'List all custom servers'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .outputList(customServerPresenter)
      .use(hasFlags(['metorial-gateway-enabled', 'paid-custom-servers']))
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(
              v.union([v.array(customServerTypeEnum), customServerTypeEnum]),
              { description: 'Filter by server type (remote, managed, docker)' }
            ),
            search: v.optional(
              v.string(),
              { description: 'Search servers by name' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await customServerService.listCustomServers({
          instance: ctx.instance,
          search: ctx.query.search,
          types: normalizeArrayParam(ctx.query.type)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customServer =>
          customServerPresenter.present({ customServer })
        );
      }),

    create: instanceGroup
      .post(instancePath('custom-servers', 'custom_servers.create'), {
        name: 'Create custom server',
        description: 'Create a new custom server'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          implementation: v.union([
            v.object({
              type: v.literal('remote'),

              remote_server: v.object({
                remote_url: v.string({ modifiers: [v.url()] }),
                remote_protocol: v.optional(v.enumOf(['sse', 'streamable_http']))
              }),

              config: v.optional(
                v.object({
                  schema: v.optional(v.any()),
                  getLaunchParams: v.optional(v.string())
                })
              )
            }),

            v.object({
              type: v.literal('managed'),

              managed_server: v.optional(
                v.object({
                  template_id: v.optional(v.string()),
                  repository: v.optional(
                    v.object({
                      repository_id: v.string(),
                      path: v.string()
                    })
                  )
                })
              ),

              config: v.optional(
                v.object({
                  schema: v.optional(v.any()),
                  getLaunchParams: v.optional(v.string())
                })
              )
            }),

            v.object({
              type: v.literal('docker'),

              docker_server: v.object({
                docker_image: v.string()
              }),

              config: v.optional(
                v.object({
                  schema: v.optional(v.any()),
                  getLaunchParams: v.optional(v.string())
                })
              )
            })
          ])
        })
      )
      .body(
        'mt_2025_01_01_pulsar',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          implementation: v.union([
            v.object({
              type: v.literal('remote'),

              remote_server: v.object({
                remote_url: v.string({ modifiers: [v.url()] }),
                remote_protocol: v.optional(v.enumOf(['sse', 'streamable_http']))
              }),

              config: v.optional(
                v.object({
                  schema: v.optional(v.any()),
                  getLaunchParams: v.optional(v.string())
                })
              )
            }),
            v.object({
              type: v.literal('managed'),

              managed_server: v.optional(
                v.object({
                  template_id: v.optional(v.string())
                })
              ),

              config: v.optional(
                v.object({
                  schema: v.optional(v.any()),
                  getLaunchParams: v.optional(v.string())
                })
              )
            }),

            v.object({
              type: v.literal('docker'),

              docker_server: v.object({
                docker_image: v.string()
              }),

              config: v.optional(
                v.object({
                  schema: v.optional(v.any()),
                  getLaunchParams: v.optional(v.string())
                })
              )
            })
          ])
        }),
        v => v
      )
      .use(hasFlags(['metorial-gateway-enabled', 'paid-custom-servers']))
      .output(customServerPresenter)
      .do(async ctx => {
        let flags = await flagService.getFlags({
          organization: ctx.organization
        });

        if (ctx.body.implementation.type == 'managed' && !flags['managed-servers-enabled']) {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not entitled to create managed servers'
            })
          );
        }

        if (ctx.body.implementation.type == 'docker' && !flags['paid-custom-docker-servers']) {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not entitled to create custom docker servers'
            })
          );
        }

        let template =
          ctx.body.implementation.type === 'managed' &&
          ctx.body.implementation.managed_server?.template_id
            ? await managedServerTemplateService.getManagedServerTemplateById({
                templateId: ctx.body.implementation.managed_server.template_id
              })
            : undefined;

        let repository =
          ctx.body.implementation.type == 'managed' &&
          ctx.body.implementation.managed_server?.repository
            ? await scmRepoService.getScmRepoById({
                organization: ctx.organization,
                scmRepoId: ctx.body.implementation.managed_server.repository.repository_id
              })
            : undefined;

        let customServer = await customServerService.createCustomServer({
          organization: ctx.organization,
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          },
          isEphemeral: false,
          performedBy: ctx.actor,
          serverInstance: switcher({
            remote: () =>
              ctx.body.implementation.type == 'remote'
                ? {
                    type: 'remote' as const,
                    implementation: {
                      remoteUrl: ctx.body.implementation.remote_server.remote_url,
                      protocol: ctx.body.implementation.remote_server.remote_protocol ?? 'sse'
                    },
                    config: {
                      schema: ctx.body.implementation.config?.schema,
                      getLaunchParams: ctx.body.implementation.config?.getLaunchParams
                    }
                  }
                : undefined!,

            managed: () =>
              ctx.body.implementation.type == 'managed'
                ? {
                    type: 'managed' as const,
                    implementation: {
                      template
                    },
                    config: {
                      schema: ctx.body.implementation.config?.schema,
                      getLaunchParams: ctx.body.implementation.config?.getLaunchParams
                    },
                    repository: repository
                      ? {
                          repo: repository,
                          path: normalizePath(
                            ctx.body.implementation.managed_server!.repository!.path
                          )
                        }
                      : undefined
                  }
                : undefined!,

            docker: () =>
              ctx.body.implementation.type == 'docker'
                ? {
                    type: 'docker' as const,
                    implementation: {
                      dockerImage: ctx.body.implementation.docker_server.docker_image
                    },
                    config: {
                      schema: ctx.body.implementation.config?.schema,
                      getLaunchParams: ctx.body.implementation.config?.getLaunchParams
                    }
                  }
                : undefined!
          })(ctx.body.implementation.type)
        });

        return customServerPresenter.present({ customServer });
      }),

    update: customServerGroup
      .patch(instancePath('custom-servers/:customServerId', 'custom_servers.update'), {
        name: 'Update custom server',
        description: 'Update a custom server'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          is_forkable: v.optional(v.boolean())
        })
      )
      .body(
        'mt_2025_01_01_pulsar',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        }),
        v => v
      )
      .use(hasFlags(['metorial-gateway-enabled', 'paid-custom-servers']))
      .output(customServerPresenter)
      .do(async ctx => {
        let customServer = await customServerService.updateCustomServer({
          server: ctx.customServer,
          instance: ctx.instance,
          organization: ctx.organization,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            isForkable: ctx.body.is_forkable
          }
        });

        return customServerPresenter.present({ customServer });
      }),

    delete: customServerGroup
      .delete(instancePath('custom-servers/:customServerId', 'custom_servers.delete'), {
        name: 'Delete custom server',
        description: 'Delete a custom server'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:write'] }))
      .output(customServerPresenter)
      .use(hasFlags(['metorial-gateway-enabled', 'paid-custom-servers']))
      .do(async ctx => {
        let customServer = await customServerService.deleteCustomServer({
          server: ctx.customServer
        });

        return customServerPresenter.present({ customServer });
      }),

    get: customServerGroup
      .get(instancePath('custom-servers/:customServerId', 'custom_servers.get'), {
        name: 'Get custom server',
        description: 'Get information for a specific custom server'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .output(customServerPresenter)
      .use(hasFlags(['metorial-gateway-enabled', 'paid-custom-servers']))
      .do(async ctx => {
        return customServerPresenter.present({
          customServer: ctx.customServer
        });
      }),

    getListing: customServerGroup
      .get(
        instancePath('custom-servers/:customServerId/listing', 'custom_servers.listing.get'),
        {
          name: 'Get custom server listing',
          description: 'Get a custom server listing'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .output(serverListingPresenter)
      .use(hasFlags(['metorial-gateway-enabled', 'paid-custom-servers']))
      .do(async ctx => {
        let listing = await serverListingService.getServerListingById({
          instance: ctx.instance,
          serverListingId: ctx.customServer.server.id
        });

        return serverListingPresenter.present({
          serverListing: listing,
          readme: listing.readme
        });
      }),

    updateListing: customServerGroup
      .patch(
        instancePath(
          'custom-servers/:customServerId/listing',
          'custom_servers.listing.update'
        ),
        {
          name: 'Update custom server listing',
          description: 'Update a custom server listing'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:write'] }))
      .body(
        'default',
        v.object({
          status: v.optional(v.enumOf(['public', 'private'])),
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          readme: v.optional(v.string()),
          oauth_explainer: v.optional(v.nullable(v.string()))
        })
      )
      .output(serverListingPresenter)
      .use(hasFlags(['metorial-gateway-enabled', 'paid-custom-servers']))
      .do(async ctx => {
        let listing = await customServerService.setCustomServerListing({
          server: ctx.customServer,
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          input: {
            isPublic: ctx.body.status ? ctx.body.status == 'public' : undefined,
            name: ctx.body.name,
            description: ctx.body.description,
            readme: ctx.body.readme,
            oauthExplainer: ctx.body.oauth_explainer
          }
        });

        return serverListingPresenter.present({
          serverListing: listing,
          readme: listing.readme
        });
      })
  }
);
