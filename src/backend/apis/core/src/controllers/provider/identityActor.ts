import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceIdentityActorService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { identityActorPresenter } from '../../presenters';

let identityActorGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.identityActorId) {
    throw new ServiceError(
      badRequestError({
        message: 'identityActorId is required',
        description: 'The identityActorId path parameter is required.'
      })
    );
  }

  let identityActor = await subspaceIdentityActorService.get({
    instance: ctx.instance,
    identityActorId: ctx.params.identityActorId,
    allowDeleted: false
  });

  return { identityActor };
});

export let identityActorController = Controller.create(
  {
    name: 'Identity Actors',
    description:
      'Identity actors represent people or agents that can own identities and participate in delegations.'
  },
  {
    list: instanceGroup
      .get(instancePath('identity-actors', 'identityActors.list'), {
        name: 'List identity actors',
        description: 'Returns a paginated list of identity actors for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .outputList(identityActorPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(
              v.string({
                description: 'Filter actors by name or description.',
                examples: ['release']
              })
            ),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              {
                description: 'Filter by one or more actor statuses.'
              }
            ),

            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity actor ID or IDs.',
              examples: ['iac_6wQpLk2mZa8nYx4b']
            }),
            agent_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by linked agent ID or IDs.',
              examples: ['agt_4mNoPq8rSt2uVx6y']
            }),
            consumer_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by linked consumer ID or IDs.',
              examples: ['csm_7nR8sK2mZa1pYx4b']
            }),

            created_at: dateFilterValidator('identity actor creation time'),
            updated_at: dateFilterValidator('identity actor last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceIdentityActorService.list({
          instance: ctx.instance,
          allowDeleted: true,

          search: ctx.query.search,

          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          agentIds: normalizeArrayParam(ctx.query.agent_id),
          consumerIds: normalizeArrayParam(ctx.query.consumer_id),

          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, identityActor =>
          identityActorPresenter.present({ identityActor })
        );
      }),

    get: identityActorGroup
      .get(instancePath('identity-actors/:identityActorId', 'identityActors.get'), {
        name: 'Get identity actor',
        description: 'Retrieves a specific identity actor by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityActorPresenter)
      .do(async ctx => identityActorPresenter.present({ identityActor: ctx.identityActor })),

    create: instanceGroup
      .post(instancePath('identity-actors', 'identityActors.create'), {
        name: 'Create identity actor',
        description: 'Creates a new identity actor.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          type: v.enumOf(['person', 'agent'], {
            description: 'Whether this actor is a person or an agent.'
          }),
          name: v.string({
            description: 'Human-readable display name for the actor.',
            examples: ['Release Bot']
          }),
          description: v.optional(
            v.string({
              description: 'Optional description of the actor.',
              examples: ['Agent used for production releases']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Additional metadata to store on the actor.',
              examples: [{ team: 'platform', managed_by: 'ops' }]
            })
          )
        })
      )
      .output(identityActorPresenter)
      .do(async ctx => {
        let identityActor = await subspaceIdentityActorService.create({
          instance: ctx.instance,

          type: ctx.body.type,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return identityActorPresenter.present({ identityActor });
      }),

    update: identityActorGroup
      .patch(instancePath('identity-actors/:identityActorId', 'identityActors.update'), {
        name: 'Update identity actor',
        description: 'Updates mutable fields on an existing identity actor.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Updated display name for the actor.',
              examples: ['Updated Release Bot']
            })
          ),
          description: v.optional(
            v.string({
              description: 'Updated description for the actor.',
              examples: ['Updated release automation actor']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Updated metadata for the actor.',
              examples: [{ team: 'platform', rotation: 'primary' }]
            })
          )
        })
      )
      .output(identityActorPresenter)
      .do(async ctx => {
        let identityActor = await subspaceIdentityActorService.update({
          instance: ctx.instance,
          identityActorId: ctx.identityActor.id,
          allowDeleted: false,

          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return identityActorPresenter.present({ identityActor });
      }),

    delete: identityActorGroup
      .delete(instancePath('identity-actors/:identityActorId', 'identityActors.delete'), {
        name: 'Delete identity actor',
        description: 'Archives an identity actor.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityActorPresenter)
      .do(async ctx => {
        let identityActor = await subspaceIdentityActorService.delete({
          instance: ctx.instance,
          identityActorId: ctx.identityActor.id,
          allowDeleted: false
        });

        return identityActorPresenter.present({ identityActor });
      })
  }
);
