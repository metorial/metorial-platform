import {
  Instance,
  Organization,
  OrganizationActor,
  ServerDeploymentStatus
} from '@metorial/db';
import {
  serverDeploymentService,
  serverImplementationService
} from '@metorial/module-server-deployment';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v, ValidationTypeValue } from '@metorial/validation';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverDeploymentPresenter } from '../../presenters';
import {
  createServerImplementation,
  createServerImplementationSchema,
  ensureDefaultServerImplementation
} from './serverImplementation';

export let serverDeploymentGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.serverDeploymentId) throw new Error('serverDeploymentId is required');

  let serverDeployment = await serverDeploymentService.getServerDeploymentById({
    serverDeploymentId: ctx.params.serverDeploymentId,
    instance: ctx.instance
  });

  return { serverDeployment };
});

export let createServerDeploymentSchema = v.intersection([
  v.object({
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.record(v.any())),
    config: v.record(v.any())
  }),
  v.union([
    v.object({
      server_implementation: createServerImplementationSchema
    }),
    v.object({
      server_implementation_id: v.string()
    }),
    v.object({
      server_variant_id: v.string()
    }),
    v.object({
      server_id: v.string()
    })
  ])
]);

export let createServerDeployment = async (
  data: ValidationTypeValue<typeof createServerDeploymentSchema>,
  ctx: {
    instance: Instance;
    organization: Organization;
    actor: OrganizationActor;
  },
  opts?: {
    type: 'persistent' | 'ephemeral';
  }
) => {
  let serverImplementation =
    'server_implementation_id' in data
      ? {
          isNewEphemeral: false,
          instance: await serverImplementationService.getServerImplementationById({
            instance: ctx.instance,
            serverImplementationId: data.server_implementation_id
          })
        }
      : {
          isNewEphemeral: true,
          instance:
            'server_implementation' in data
              ? await createServerImplementation(data.server_implementation, ctx, {
                  type: 'ephemeral'
                })
              : await ensureDefaultServerImplementation(data, ctx)
        };

  let serverDeployment = await serverDeploymentService.createServerDeployment({
    organization: ctx.organization,
    performedBy: ctx.actor,
    instance: ctx.instance,
    serverImplementation,
    type: opts?.type ?? 'persistent',
    input: {
      name: data.name?.trim() || undefined,
      description: data.description?.trim() || undefined,
      metadata: data.metadata,
      config: data.config
    }
  });

  return serverDeployment;
};

export let serverDeploymentController = Controller.create(
  {
    name: 'Server Instance',
    description: 'Read and write server instance information'
  },
  {
    list: instanceGroup
      .get(instancePath('server-deployments', 'servers.deployments.list'), {
        name: 'List server deployments',
        description: 'List all server deployments'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:read'] }))
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
            server_implementation_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await serverDeploymentService.listServerDeployments({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any,
          serverIds: normalizeArrayParam(ctx.query.server_ids),
          serverVariantIds: normalizeArrayParam(ctx.query.server_variant_ids),
          serverImplementationIds: normalizeArrayParam(ctx.query.server_implementation_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverDeployment =>
          serverDeploymentPresenter.present({ serverDeployment })
        );
      }),

    get: serverDeploymentGroup
      .get(instancePath('server-deployments/:serverDeploymentId', 'servers.deployments.get'), {
        name: 'Get server instance',
        description: 'Get the information of a specific server instance'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:read'] }))
      .output(serverDeploymentPresenter)
      .do(async ctx => {
        return serverDeploymentPresenter.present({ serverDeployment: ctx.serverDeployment });
      }),

    create: instanceGroup
      .post(instancePath('server-deployments', 'servers.deployments.create'), {
        name: 'Create server instance',
        description: 'Create a new server instance'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .body('default', createServerDeploymentSchema)
      .output(serverDeploymentPresenter)
      .do(async ctx => {
        let serverDeployment = await createServerDeployment(
          ctx.body,
          {
            instance: ctx.instance,
            organization: ctx.organization,
            actor: ctx.actor
          },
          { type: 'persistent' }
        );

        return serverDeploymentPresenter.present({ serverDeployment });
      }),

    update: serverDeploymentGroup
      .patch(
        instancePath('server-deployments/:serverDeploymentId', 'servers.deployments.update'),
        {
          name: 'Update server instance',
          description: 'Update a server instance'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
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
            name: ctx.body.name?.trim() || undefined,
            description: ctx.body.description?.trim() || null,
            metadata: ctx.body.metadata,
            config: ctx.body.config
          }
        });

        return serverDeploymentPresenter.present({ serverDeployment });
      }),

    delete: serverDeploymentGroup
      .delete(
        instancePath('server-deployments/:serverDeploymentId', 'servers.deployments.delete'),
        {
          name: 'Delete server instance',
          description: 'Delete a server instance'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
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
