import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { identityActorService, identityService } from '@metorial-subspace/module-identity';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { identityPresenter } from '@metorial/presenters';

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

  let identity = await identityService.getIdentityById({
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
      'An identity is a set of provider credentials owned by one actor. It lets you manage and delegate provider access consistently.',
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
                description: 'Only return identities with one of these statuses.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return identities with one of these IDs.',
              examples: ['idn_5gHjKlMnPqRsTuVw']
            }),
            agent_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return identities owned by one of these agents.',
              examples: ['agt_4mNoPq8rSt2uVx6y']
            }),
            actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return identities owned by one of these identity actors.',
              examples: ['iac_6wQpLk2mZa8nYx4b']
            }),
            created_at: dateFilterValidator('identity creation time'),
            updated_at: dateFilterValidator('identity last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await identityService.listIdentities({
          instance: ctx.instance,
          allowDeleted: false,

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
        description: 'Retrieves an identity.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityPresenter)
      .do(async ctx => identityPresenter.present({ identity: ctx.identity })),

    create: instanceGroup
      .post(instancePath('identities', 'identities.create'), {
        name: 'Create identity',
        description: 'Creates an identity.'
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
              description: 'Display name.',
              examples: ['Production GitHub Identity']
            })
          ),
          description: v.optional(
            v.string({
              description: 'Free-text description.',
              examples: ['Identity used by the release pipeline']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom data to identify or organize the identity.',
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
        let actor = await identityActorService.getIdentityActorById({
          instance: ctx.instance,
          identityActorId: ctx.body.actor_id
        });
        let identity = await identityService.createIdentity({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          actor,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            inputs: (ctx.body.credentials ?? []).map(input => ({
              deploymentId: input.deployment_id,
              configId: input.config_id,
              authConfigId: input.auth_config_id,
              delegationConfigId: input.delegation_config_id
            }))
          }
        });

        return identityPresenter.present({ identity });
      }),

    update: identityGroup
      .patch(instancePath('identities/:identityId', 'identities.update'), {
        name: 'Update identity',
        description: 'Updates an identity. Omitted fields keep their current value.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Display name.',
              examples: ['Updated Production GitHub Identity']
            })
          ),
          description: v.optional(
            v.string({
              description: 'Free-text description.',
              examples: ['Updated identity used by the release pipeline']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description:
                'Custom data to identify or organize the identity. Replaces existing metadata.',
              examples: [{ environment: 'staging', owner: 'release-team' }]
            })
          )
        })
      )
      .output(identityPresenter)
      .do(async ctx => {
        let identity = await identityService.updateIdentity({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          identity: ctx.identity,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return identityPresenter.present({ identity });
      }),

    delete: identityGroup
      .delete(instancePath('identities/:identityId', 'identities.delete'), {
        name: 'Archive identity',
        description: 'Archives an identity. It stays listable with `status=archived`.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityPresenter)
      .do(async ctx => {
        let identity = await identityService.archiveIdentity({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          identity: ctx.identity
        });

        return identityPresenter.present({ identity });
      })
  }
);
