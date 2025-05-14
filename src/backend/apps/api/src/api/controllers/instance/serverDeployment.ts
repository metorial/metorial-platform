import { ServerDeploymentStatus } from '@metorial/db';
import {
  serverDeploymentService,
  serverInstanceService
} from '@metorial/module-server-deployment';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverDeploymentPresenter } from '../../presenters';
import { createServerInstance, createServerInstanceSchema } from './serverInstance';

export let serverDeploymentGroup = instanceGroup.use(async ctx => {
  let serverDeployment = await serverDeploymentService.getServerDeploymentById({
    serverDeploymentId: ctx.params.serverDeploymentId,
    instance: ctx.instance
  });

  return { serverDeployment };
});

export let serverDeploymentController = Controller.create(
  {
    name: 'Server Instance',
    description: 'Read and write server instance information'
  },
  {
    list: instanceGroup
      .get(instancePath('instances', 'servers.instances.list'), {
        name: 'List server instances',
        description: 'List all server instances'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.instance:read'] }))
      .outputList(serverDeploymentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(ServerDeploymentStatus) as any),
                v.array(v.enumOf(Object.keys(ServerDeploymentStatus) as any))
              ])
            ),
            server_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_variant_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_instance_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await serverDeploymentService.listServerDeployments({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any,
          serverIds: normalizeArrayParam(ctx.query.server_ids),
          serverVariantIds: normalizeArrayParam(ctx.query.server_variant_ids),
          serverInstanceIds: normalizeArrayParam(ctx.query.server_instance_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverDeployment =>
          serverDeploymentPresenter.present({ serverDeployment })
        );
      }),

    get: serverDeploymentGroup
      .get(instancePath('instances/:serverDeploymentId', 'servers.instances.get'), {
        name: 'Get server instance',
        description: 'Get the information of a specific server instance'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.instance:read'] }))
      .output(serverDeploymentPresenter)
      .do(async ctx => {
        return serverDeploymentPresenter.present({ serverDeployment: ctx.serverDeployment });
      }),

    create: serverDeploymentGroup
      .post(instancePath('instances', 'servers.instances.create'), {
        name: 'Create server instance',
        description: 'Create a new server instance'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.instance:write'] }))
      .body(
        'default',
        v.intersection([
          v.object({
            name: v.optional(v.string()),
            description: v.optional(v.string()),
            metadata: v.optional(v.record(v.any())),
            config: v.record(v.any())
          }),
          v.union([
            v.object({
              server_instance_id: v.string()
            }),
            v.object({
              server_instance: createServerInstanceSchema
            })
          ])
        ])
      )
      .output(serverDeploymentPresenter)
      .do(async ctx => {
        let serverInstance =
          'server_instance_id' in ctx.body
            ? {
                isNewEphemeral: false,
                instance: await serverInstanceService.getServerInstanceById({
                  instance: ctx.instance,
                  serverInstanceId: ctx.body.server_instance_id
                })
              }
            : {
                isNewEphemeral: true,
                instance: await createServerInstance(ctx.body.server_instance, ctx, {
                  type: 'ephemeral'
                })
              };

        let serverDeployment = await serverDeploymentService.createServerDeployment({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          serverInstance,
          type: 'persistent',
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            config: ctx.body.config
          }
        });

        return serverDeploymentPresenter.present({ serverDeployment });
      }),

    update: serverDeploymentGroup
      .patch(instancePath('instances/:serverDeploymentId', 'servers.instances.update'), {
        name: 'Update server instance',
        description: 'Update a server instance'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.instance:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          config: v.optional(v.record(v.any()))
        })
      )
      .output(serverDeploymentPresenter)
      .do(async ctx => {
        let serverDeployment = await serverDeploymentService.updateServerDeployment({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          serverDeployment: ctx.serverDeployment,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            config: ctx.body.config
          }
        });

        return serverDeploymentPresenter.present({ serverDeployment });
      }),

    delete: serverDeploymentGroup
      .delete(instancePath('instances/:serverDeploymentId', 'servers.instances.delete'), {
        name: 'Delete server instance',
        description: 'Delete a server instance'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.instance:write'] }))
      .output(serverDeploymentPresenter)
      .do(async ctx => {
        let serverDeployment = await serverDeploymentService.deleteServerDeployment({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          serverDeployment: ctx.serverDeployment
        });

        return serverDeploymentPresenter.present({ serverDeployment });
      })
  }
);
