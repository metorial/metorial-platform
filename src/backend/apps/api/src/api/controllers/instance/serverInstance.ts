import { Instance, Organization, OrganizationActor, ServerInstanceStatus } from '@metorial/db';
import { serverVariantService } from '@metorial/module-catalog';
import { serverInstanceService } from '@metorial/module-server-deployment';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v, ValidationTypeValue } from '@metorial/validation';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverInstancePresenter } from '../../presenters';

export let serverInstanceGroup = instanceGroup.use(async ctx => {
  let serverInstance = await serverInstanceService.getServerInstanceById({
    serverInstanceId: ctx.params.serverInstanceId,
    instance: ctx.instance
  });

  return { serverInstance };
});

export let createServerInstanceSchema = v.intersection([
  v.object({
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.record(v.any())),
    get_launch_params: v.optional(v.string())
  }),
  v.union([
    v.object({
      server_id: v.string()
    }),
    v.object({
      server_variant_id: v.string()
    })
  ])
]);

export let createServerInstance = async (
  data: ValidationTypeValue<typeof createServerInstanceSchema>,
  ctx: {
    instance: Instance;
    organization: Organization;
    actor: OrganizationActor;
  },
  opts?: {
    type: 'persistent' | 'ephemeral';
  }
) => {
  let serverVariant = await serverVariantService.getServerVariantByIdOrLatestServerVariant({
    instance: ctx.instance,
    serverVariantId: 'server_variant_id' in data ? data.server_variant_id : undefined,
    serverId: 'server_id' in data ? data.server_id : undefined
  });

  return await serverInstanceService.createServerInstance({
    organization: ctx.organization,
    performedBy: ctx.actor,
    instance: ctx.instance,
    serverVariant,
    type: opts?.type ?? 'persistent',
    input: {
      name: data.name,
      description: data.description,
      metadata: data.metadata,
      getLaunchParams: data.get_launch_params
    }
  });
};

export let serverInstanceController = Controller.create(
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
      .outputList(serverInstancePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(ServerInstanceStatus) as any),
                v.array(v.enumOf(Object.keys(ServerInstanceStatus) as any))
              ])
            ),
            server_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_variant_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await serverInstanceService.listServerInstances({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any,
          serverIds: normalizeArrayParam(ctx.query.server_ids),
          serverVariantIds: normalizeArrayParam(ctx.query.server_variant_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverInstance =>
          serverInstancePresenter.present({ serverInstance })
        );
      }),

    get: serverInstanceGroup
      .get(instancePath('instances/:serverInstanceId', 'servers.instances.get'), {
        name: 'Get server instance',
        description: 'Get the information of a specific server instance'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.instance:read'] }))
      .output(serverInstancePresenter)
      .do(async ctx => {
        return serverInstancePresenter.present({ serverInstance: ctx.serverInstance });
      }),

    create: serverInstanceGroup
      .post(instancePath('instances', 'servers.instances.create'), {
        name: 'Create server instance',
        description: 'Create a new server instance'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.instance:write'] }))
      .body('default', createServerInstanceSchema)
      .output(serverInstancePresenter)
      .do(async ctx => {
        let serverInstance = await createServerInstance(ctx.body, ctx);

        return serverInstancePresenter.present({ serverInstance });
      }),

    update: serverInstanceGroup
      .patch(instancePath('instances/:serverInstanceId', 'servers.instances.update'), {
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
          get_launch_params: v.optional(v.string())
        })
      )
      .output(serverInstancePresenter)
      .do(async ctx => {
        let serverInstance = await serverInstanceService.updateServerInstance({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          serverInstance: ctx.serverInstance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            getLaunchParams: ctx.body.get_launch_params
          }
        });

        return serverInstancePresenter.present({ serverInstance });
      }),

    delete: serverInstanceGroup
      .delete(instancePath('instances/:serverInstanceId', 'servers.instances.delete'), {
        name: 'Delete server instance',
        description: 'Delete a server instance'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.instance:write'] }))
      .output(serverInstancePresenter)
      .do(async ctx => {
        let serverInstance = await serverInstanceService.deleteServerInstance({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          serverInstance: ctx.serverInstance
        });

        return serverInstancePresenter.present({ serverInstance });
      })
  }
);
