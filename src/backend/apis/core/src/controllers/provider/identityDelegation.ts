import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceIdentityDelegationService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { identityDelegationPresenter } from '../../presenters';

let delegationCredentialOverrideValidator = v.object({
  credential_id: v.string({
    description: 'Credential that should receive override permissions.',
    examples: ['icr_8vBnM4xZa2cDf7gH']
  }),
  permissions: v.optional(
    v.array(v.enumOf(['provider:call', 'provider:read']), {
      description: 'Permissions to grant on the credential override.',
      examples: [['provider:read']]
    })
  ),
  expires_at: v.optional(
    v.date({
      description: 'Optional expiration timestamp for the credential override.',
      examples: [new Date('2026-03-03T10:15:00Z')]
    })
  )
});

let identityDelegationGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.identityDelegationId) {
    throw new ServiceError(
      badRequestError({
        message: 'identityDelegationId is required',
        description: 'The identityDelegationId path parameter is required.'
      })
    );
  }

  let identityDelegation = await subspaceIdentityDelegationService.get({
    instance: ctx.instance,
    identityDelegationId: ctx.params.identityDelegationId,
    allowDeleted: false
  });

  return { identityDelegation };
});

export let identityDelegationController = Controller.create(
  {
    name: 'Identity Delegations',
    description:
      'Identity delegations grant provider permissions from one identity owner to another actor, with optional per-credential overrides.'
  },
  {
    list: instanceGroup
      .get(instancePath('identity-delegations', 'identities.delegations.list'), {
        name: 'List identity delegations',
        description: 'Returns a paginated list of identity delegations for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .outputList(identityDelegationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['waiting_for_consent', 'denied', 'active', 'revoked', 'expired']),
                v.array(
                  v.enumOf(['waiting_for_consent', 'denied', 'active', 'revoked', 'expired'])
                )
              ]),
              {
                description: 'Filter by one or more delegation statuses.'
              }
            ),
            permissions: v.optional(
              v.union([
                v.enumOf(['provider:call', 'provider:read']),
                v.array(v.enumOf(['provider:call', 'provider:read']))
              ]),
              {
                description: 'Filter by one or more granted permissions.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by delegation ID or IDs.',
              examples: ['idd_7gHjKlMnPqRsTuVw']
            }),
            owner_actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by owner actor ID or IDs.',
              examples: ['iac_6wQpLk2mZa8nYx4b']
            }),
            delegator_actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by delegator actor ID or IDs.',
              examples: ['iac_1aBcDeFgHiJkLmNo']
            }),
            delegatee_actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by delegatee actor ID or IDs.',
              examples: ['iac_9zYxWvUtSrQpOnMl']
            }),
            identity_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity ID or IDs.',
              examples: ['idn_5gHjKlMnPqRsTuVw']
            }),
            created_at: dateFilterValidator('identity delegation creation time'),
            updated_at: dateFilterValidator('identity delegation last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceIdentityDelegationService.list({
          instance: ctx.instance,

          status: normalizeArrayParam(ctx.query.status),
          permissions: normalizeArrayParam(ctx.query.permissions),
          ids: normalizeArrayParam(ctx.query.id),
          ownerActorIds: normalizeArrayParam(ctx.query.owner_actor_id),
          delegatorActorIds: normalizeArrayParam(ctx.query.delegator_actor_id),
          delegateeActorIds: normalizeArrayParam(ctx.query.delegatee_actor_id),
          identityIds: normalizeArrayParam(ctx.query.identity_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, identityDelegation =>
          identityDelegationPresenter.present({ identityDelegation })
        );
      }),

    get: identityDelegationGroup
      .get(
        instancePath(
          'identity-delegations/:identityDelegationId',
          'identities.delegations.get'
        ),
        {
          name: 'Get identity delegation',
          description: 'Retrieves a specific identity delegation by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityDelegationPresenter)
      .do(async ctx =>
        identityDelegationPresenter.present({ identityDelegation: ctx.identityDelegation })
      ),

    create: instanceGroup
      .post(instancePath('identity-delegations', 'identities.delegations.create'), {
        name: 'Create identity delegation',
        description: 'Creates a new identity delegation.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          identity_id: v.string({
            description: 'Identity to delegate.',
            examples: ['idn_5gHjKlMnPqRsTuVw']
          }),
          delegator_actor_id: v.optional(
            v.string({
              description: 'Actor initiating the delegation, if different from the owner.',
              examples: ['iac_1aBcDeFgHiJkLmNo']
            })
          ),
          delegatee_actor_id: v.string({
            description: 'Actor receiving the delegation.',
            examples: ['iac_9zYxWvUtSrQpOnMl']
          }),
          permissions: v.optional(
            v.array(v.enumOf(['provider:call', 'provider:read']), {
              description: 'Permissions to grant as part of the delegation.',
              examples: [['provider:read', 'provider:call']]
            })
          ),
          expires_at: v.optional(
            v.date({
              description: 'Optional expiration timestamp for the delegation.',
              examples: [new Date('2026-03-03T10:15:00Z')]
            })
          ),
          delegation_config_id: v.optional(
            v.string({
              description: 'Delegation config to use for this delegation.',
              examples: ['idc_2mNpQrStUvWxYzAb']
            })
          ),
          credential_overrides: v.optional(
            v.array(delegationCredentialOverrideValidator, {
              description: 'Optional per-credential permission overrides.'
            })
          ),
          note: v.optional(
            v.string({
              description: 'Optional human-readable note for the delegation.',
              examples: ['Temporary support access for incident triage']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Additional metadata to store on the delegation.',
              examples: [{ incident: 'INC-2048', requested_by: 'support' }]
            })
          )
        })
      )
      .output(identityDelegationPresenter)
      .do(async ctx => {
        let identityDelegation = await subspaceIdentityDelegationService.create({
          instance: ctx.instance,

          identityId: ctx.body.identity_id,
          delegatorActorId: ctx.body.delegator_actor_id,
          delegateeActorId: ctx.body.delegatee_actor_id,

          permissions: ctx.body.permissions,
          expiresAt: ctx.body.expires_at,
          delegationConfigId: ctx.body.delegation_config_id,

          note: ctx.body.note,
          metadata: ctx.body.metadata,

          credentialOverrides: ctx.body.credential_overrides?.map(override => ({
            credentialId: override.credential_id,
            permissions: override.permissions,
            expiresAt: override.expires_at
          }))
        });

        return identityDelegationPresenter.present({ identityDelegation });
      }),

    revoke: identityDelegationGroup
      .post(
        instancePath(
          'identity-delegations/:identityDelegationId/revoke',
          'identities.delegations.revoke'
        ),
        {
          name: 'Revoke identity delegation',
          description: 'Revokes an existing identity delegation.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityDelegationPresenter)
      .do(async ctx => {
        let identityDelegation = await subspaceIdentityDelegationService.revoke({
          instance: ctx.instance,
          identityDelegationId: ctx.identityDelegation.id,
          allowDeleted: false
        });

        return identityDelegationPresenter.present({ identityDelegation });
      })
  }
);
