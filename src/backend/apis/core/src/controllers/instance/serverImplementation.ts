import {
  Instance,
  Organization,
  OrganizationActor,
  ServerImplementationStatus
} from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { serverVariantService } from '@metorial/module-catalog';
import { serverImplementationService } from '@metorial/module-server-deployment';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v, ValidationTypeValue } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverImplementationPresenter } from '../../presenters';

export let serverImplementationGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.serverImplementationId)
    throw new Error('serverImplementationId is required');

  let serverImplementation = await serverImplementationService.getServerImplementationById({
    serverImplementationId: ctx.params.serverImplementationId,
    instance: ctx.instance
  });

  return { serverImplementation };
});

export let createServerImplementationSchema = v.intersection([
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

export let createServerImplementation = async (
  data: ValidationTypeValue<typeof createServerImplementationSchema>,
  ctx: {
    instance: Instance;
    organization: Organization;
    actor: OrganizationActor;
  },
  opts?: {
    type: 'persistent' | 'ephemeral';
  }
) => {
  let serverVariant = await serverVariantService.getServerVariantByIdOrLatestServerVariantSafe(
    {
      instance: ctx.instance,
      serverVariantId: 'server_variant_id' in data ? data.server_variant_id : undefined,
      serverId: 'server_id' in data ? data.server_id : undefined
    }
  );
  if (!serverVariant) {
    throw new ServiceError(
      badRequestError({
        message: 'Server is not deployable (no variant)'
      })
    );
  }

  return await serverImplementationService.createServerImplementation({
    organization: ctx.organization,
    performedBy: ctx.actor,
    instance: ctx.instance,
    serverVariant,
    type: opts?.type ?? 'persistent',
    input: {
      name: data.name?.trim() || undefined,
      description: data.description?.trim() || undefined,
      metadata: data.metadata,
      getLaunchParams: data.get_launch_params
    }
  });
};

export let ensureDefaultServerImplementation = async (
  data: { server_id: string } | { server_variant_id: string },
  ctx: {
    instance: Instance;
    organization: Organization;
    actor: OrganizationActor;
  }
) => {
  let serverVariant = await serverVariantService.getServerVariantByIdOrLatestServerVariantSafe(
    {
      instance: ctx.instance,
      serverVariantId: 'server_variant_id' in data ? data.server_variant_id : undefined,
      serverId: 'server_id' in data ? data.server_id : undefined
    }
  );
  if (!serverVariant) {
    throw new ServiceError(
      badRequestError({
        message: 'Server is not deployable (no variant)'
      })
    );
  }

  return await serverImplementationService.ensureDefaultImplementation({
    organization: ctx.organization,
    performedBy: ctx.actor,
    instance: ctx.instance,
    serverVariant
  });
};

export let serverImplementationController = Controller.create(
  {
    name: 'Server Implementation',
    description:
      'Manage server implementations tied to a server or server variant within an instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('server-implementations', 'servers.implementations.list'), {
        name: 'List server implementations',
        description:
          'Retrieve all server implementations in the instance. Supports filtering by status, server, or variant.'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.implementation:read'] }))
      .outputList(serverImplementationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(ServerImplementationStatus) as any),
                v.array(v.enumOf(Object.keys(ServerImplementationStatus) as any))
              ])
            ),
            server_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_variant_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await serverImplementationService.listServerImplementations({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any,
          serverIds: normalizeArrayParam(ctx.query.server_id),
          serverVariantIds: normalizeArrayParam(ctx.query.server_variant_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverImplementation =>
          serverImplementationPresenter.present({ serverImplementation })
        );
      }),

    get: serverImplementationGroup
      .get(
        instancePath(
          'server-implementations/:serverImplementationId',
          'servers.implementations.get'
        ),
        {
          name: 'Get server implementation',
          description: 'Fetch detailed information about a specific server implementation.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.implementation:read'] }))
      .output(serverImplementationPresenter)
      .do(async ctx => {
        return serverImplementationPresenter.present({
          serverImplementation: ctx.serverImplementation
        });
      }),

    create: instanceGroup
      .post(instancePath('server-implementations', 'servers.implementations.create'), {
        name: 'Create server implementation',
        description:
          'Create a new server implementation for a specific server or server variant.'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.implementation:write'] }))
      .body('default', createServerImplementationSchema)
      .output(serverImplementationPresenter)
      .do(async ctx => {
        let serverImplementation = await createServerImplementation(ctx.body, ctx);

        return serverImplementationPresenter.present({ serverImplementation });
      }),

    update: serverImplementationGroup
      .patch(
        instancePath(
          'server-implementations/:serverImplementationId',
          'servers.implementations.update'
        ),
        {
          name: 'Update server implementation',
          description:
            'Update metadata, launch parameters, or other fields of a server implementation.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.implementation:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          get_launch_params: v.optional(v.string())
        })
      )
      .output(serverImplementationPresenter)
      .do(async ctx => {
        let serverImplementation =
          await serverImplementationService.updateServerImplementation({
            organization: ctx.organization,
            performedBy: ctx.actor,
            instance: ctx.instance,
            serverImplementation: ctx.serverImplementation,
            input: {
              name: ctx.body.name?.trim() || undefined,
              description: ctx.body.description?.trim() || null,
              metadata: ctx.body.metadata,
              getLaunchParams: ctx.body.get_launch_params
            }
          });

        return serverImplementationPresenter.present({ serverImplementation });
      }),

    delete: serverImplementationGroup
      .delete(
        instancePath(
          'server-implementations/:serverImplementationId',
          'servers.implementations.delete'
        ),
        {
          name: 'Delete server implementation',
          description: 'Delete a specific server implementation from the instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.implementation:write'] }))
      .output(serverImplementationPresenter)
      .do(async ctx => {
        let serverImplementation =
          await serverImplementationService.deleteServerImplementation({
            organization: ctx.organization,
            performedBy: ctx.actor,
            instance: ctx.instance,
            serverImplementation: ctx.serverImplementation
          });

        return serverImplementationPresenter.present({ serverImplementation });
      })
  }
);
