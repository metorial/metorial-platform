import { badRequestError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { subspaceIdentityService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { identityPresenter } from '../../../presenters';

let identityCredentialInputValidator = v.object({
  deployment_id: v.optional(
    v.string({
      description: 'Provider deployment to attach to the identity.',
      examples: ['pdp_4dEfGhJkLmNpQrSt']
    })
  ),
  config_id: v.optional(
    v.string({
      description: 'Provider config to attach to the identity.',
      examples: ['pcf_7dEfGhJkLmNpQrSt']
    })
  ),
  auth_config_id: v.optional(
    v.string({
      description: 'Provider auth config to attach to the identity.',
      examples: ['pac_3nOpRsTuVwXyZaBc']
    })
  ),
  delegation_config_id: v.optional(
    v.string({
      description: 'Delegation config to apply to the new credential.',
      examples: ['idc_2mNpQrStUvWxYzAb']
    })
  )
});

let identityGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.identityId) {
    throw new ServiceError(
      badRequestError({
        message: 'identityId is required',
        description: 'The identityId path parameter is required.'
      })
    );
  }

  let identity = await subspaceIdentityService.get({
    instance: ctx.instance,
    identityId: ctx.params.identityId,
    allowDeleted: false
  });

  return { identity };
});

export let identityController = Controller.create(
  {
    name: 'Identities',
    description:
      'Identities bundle credentials under a single owner actor so provider access can be managed and delegated consistently.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('identities', 'identities.list'), {
        name: 'List identities',
        description: 'Returns a paginated list of identities for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .outputList(identityPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(
              v.string({
                description: 'Filter identities by name or description.',
                examples: ['github']
              })
            ),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              {
                description: 'Filter by one or more identity statuses.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity ID or IDs.',
              examples: ['idn_5gHjKlMnPqRsTuVw']
            }),
            agent_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by owner agent ID or IDs.',
              examples: ['agt_4mNoPq8rSt2uVx6y']
            }),
            actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by owner identity actor ID or IDs.',
              examples: ['iac_6wQpLk2mZa8nYx4b']
            }),
            created_at: dateFilterValidator('identity creation time'),
            updated_at: dateFilterValidator('identity last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceIdentityService.list({
          instance: ctx.instance,
          allowDeleted: true,

          search: ctx.query.search,

          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          agentIds: normalizeArrayParam(ctx.query.agent_id),
          actorIds: normalizeArrayParam(ctx.query.actor_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, identity => identityPresenter.present({ identity }));
      }),

    get: identityGroup
      .get(instancePath('identities/:identityId', 'identities.get'), {
        name: 'Get identity',
        description: 'Retrieves a specific identity by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityPresenter)
      .do(async ctx => identityPresenter.present({ identity: ctx.identity })),

    create: instanceGroup
      .post(instancePath('identities', 'identities.create'), {
        name: 'Create identity',
        description: 'Creates a new identity owned by an existing identity actor.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          actor_id: v.string({
            description: 'Identity actor that will own the new identity.',
            examples: ['iac_6wQpLk2mZa8nYx4b']
          }),
          name: v.optional(
            v.string({
              description: 'Optional display name for the identity.',
              examples: ['Production GitHub Identity']
            })
          ),
          description: v.optional(
            v.string({
              description: 'Optional description of the identity.',
              examples: ['Identity used by the release pipeline']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Additional metadata to store on the identity.',
              examples: [{ environment: 'production', owner: 'platform' }]
            })
          ),
          credentials: v.optional(
            v.array(identityCredentialInputValidator, {
              description: 'Credentials to create and attach as part of identity creation.'
            })
          )
        })
      )
      .output(identityPresenter)
      .do(async ctx => {
        let identity = await subspaceIdentityService.create({
          instance: ctx.instance,
          identityActorId: ctx.body.actor_id,

          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,

          inputs: (ctx.body.credentials ?? []).map(input => ({
            deploymentId: input.deployment_id,
            configId: input.config_id,
            authConfigId: input.auth_config_id,
            delegationConfigId: input.delegation_config_id
          }))
        });

        return identityPresenter.present({ identity });
      }),

    update: identityGroup
      .patch(instancePath('identities/:identityId', 'identities.update'), {
        name: 'Update identity',
        description: 'Updates mutable fields on an existing identity.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Updated display name for the identity.',
              examples: ['Updated Production GitHub Identity']
            })
          ),
          description: v.optional(
            v.string({
              description: 'Updated description for the identity.',
              examples: ['Updated identity used by the release pipeline']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Updated metadata for the identity.',
              examples: [{ environment: 'staging', owner: 'release-team' }]
            })
          )
        })
      )
      .output(identityPresenter)
      .do(async ctx => {
        let identity = await subspaceIdentityService.update({
          instance: ctx.instance,
          identityId: ctx.identity.id,
          allowDeleted: false,

          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return identityPresenter.present({ identity });
      }),

    delete: identityGroup
      .delete(instancePath('identities/:identityId', 'identities.delete'), {
        name: 'Delete identity',
        description: 'Archives an identity.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityPresenter)
      .do(async ctx => {
        let identity = await subspaceIdentityService.delete({
          instance: ctx.instance,
          identityId: ctx.identity.id,
          allowDeleted: false
        });

        return identityPresenter.present({ identity });
      })
  }
);
