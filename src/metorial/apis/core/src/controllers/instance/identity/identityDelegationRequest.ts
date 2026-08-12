import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  identityActorService,
  identityDelegationRequestService,
  identityService
} from '@metorial-subspace/module-identity';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { identityDelegationRequestPresenter } from '@metorial/presenters';

let mapIdentityPermissions = (permissions?: ('provider:call' | 'provider:read')[]) =>
  permissions?.map(
    permission =>
      (
        ({
          'provider:call': 'provider_call',
          'provider:read': 'provider_read'
        }) as const
      )[permission]
  );

let delegationCredentialOverrideValidator = v.object({
  credential_id: v.string({
    description: 'Credential that should receive override permissions.',
    examples: ['icr_8vBnM4xZa2cDf7gH']
  }),
  permissions: v.optional(
    v.array(v.enumOf(['provider:call', 'provider:read']), {
      description: 'Permissions to grant on the credential override.'
    })
  ),
  expires_at: v.optional(
    v.date({
      description: 'Optional expiration timestamp for the credential override.',
      examples: [new Date('2026-03-03T10:15:00Z')]
    })
  )
});

let identityDelegationRequestGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.identityDelegationRequestId) {
    throw new ServiceError(
      badRequestError({
        message: 'identityDelegationRequestId is required',
        description: 'The identityDelegationRequestId path parameter is required.'
      })
    );
  }

  let identityDelegationRequest =
    await identityDelegationRequestService.getIdentityDelegationRequestById({
      instance: ctx.instance,
      identityDelegationRequestId: ctx.params.identityDelegationRequestId,
      allowDeleted:
        ctx.query.allow_deleted == null
          ? undefined
          : String(ctx.query.allow_deleted) === 'true'
    });

  return { identityDelegationRequest };
});

export let identityDelegationRequestController = Controller.create(
  {
    name: 'Identity Delegation Requests',
    description:
      'Identity delegation requests represent approval workflows for creating delegations that require consent.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(
        instancePath('identity-delegation-requests', 'identities.delegationRequests.list'),
        {
          name: 'List identity delegation requests',
          description: 'Returns a paginated list of identity delegation requests.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .outputList(identityDelegationRequestPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['pending', 'approved', 'denied', 'canceled']),
                v.array(v.enumOf(['pending', 'approved', 'denied', 'canceled']))
              ]),
              {
                description: 'Filter by one or more delegation request statuses.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by delegation request ID or IDs.',
              examples: ['idr_2mNpQrStUvWxYzAb']
            }),
            actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by requester actor ID or IDs.',
              examples: ['iac_6wQpLk2mZa8nYx4b']
            }),
            identity_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity ID or IDs.',
              examples: ['idn_5gHjKlMnPqRsTuVw']
            }),
            created_at: dateFilterValidator('identity delegation request creation time'),
            updated_at: dateFilterValidator('identity delegation request last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await identityDelegationRequestService.listIdentityDelegationRequests({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          actorIds: normalizeArrayParam(ctx.query.actor_id),
          identityIds: normalizeArrayParam(ctx.query.identity_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, identityDelegationRequest =>
          identityDelegationRequestPresenter.present({ identityDelegationRequest })
        );
      }),

    get: identityDelegationRequestGroup
      .get(
        instancePath(
          'identity-delegation-requests/:identityDelegationRequestId',
          'identities.delegationRequests.get'
        ),
        {
          name: 'Get identity delegation request',
          description: 'Retrieves a specific identity delegation request by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .query(
        'default',
        v.object({
          allow_deleted: v.optional(
            v.boolean({
              description: 'Return the request even if it has been deleted.',
              examples: [false]
            })
          )
        })
      )
      .output(identityDelegationRequestPresenter)
      .do(async ctx =>
        identityDelegationRequestPresenter.present({
          identityDelegationRequest: ctx.identityDelegationRequest
        })
      ),

    create: instanceGroup
      .post(
        instancePath('identity-delegation-requests', 'identities.delegationRequests.create'),
        {
          name: 'Create identity delegation request',
          description: 'Creates a new identity delegation request.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          identity_id: v.string({
            description: 'Identity to request delegation for.',
            examples: ['idn_5gHjKlMnPqRsTuVw']
          }),
          requester_actor_id: v.string({
            description: 'Actor requesting the delegation.',
            examples: ['iac_6wQpLk2mZa8nYx4b']
          }),
          delegator_actor_id: v.optional(
            v.string({
              description: 'Actor submitting the request on behalf of the requester.',
              examples: ['iac_1aBcDeFgHiJkLmNo']
            })
          ),
          permissions: v.optional(
            v.array(v.enumOf(['provider:call', 'provider:read']), {
              description: 'Permissions being requested.'
            })
          ),
          expires_at: v.date({
            description: 'Timestamp when the request should expire.',
            examples: [new Date('2026-03-03T10:15:00Z')]
          }),
          delegation_config_id: v.optional(
            v.string({
              description: 'Delegation config to use for the resulting delegation.',
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
              description: 'Optional human-readable note for the request.',
              examples: ['Need temporary support access for incident triage']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Additional metadata to store on the request.',
              examples: [{ incident: 'INC-2048', requested_by: 'support' }]
            })
          )
        })
      )
      .output(identityDelegationRequestPresenter)
      .do(async ctx => {
        let [identity, requester, delegator] = await Promise.all([
          identityService.getIdentityById({
            instance: ctx.instance,
            identityId: ctx.body.identity_id
          }),
          identityActorService.getIdentityActorById({
            instance: ctx.instance,
            identityActorId: ctx.body.requester_actor_id
          }),
          ctx.body.delegator_actor_id
            ? identityActorService.getIdentityActorById({
                instance: ctx.instance,
                identityActorId: ctx.body.delegator_actor_id
              })
            : Promise.resolve(undefined)
        ]);
        let identityDelegationRequest =
          await identityDelegationRequestService.createIdentityDelegationRequest({
            instance: ctx.instance,
            input: {
              identity,
              requester,
              delegator,
              permissions: mapIdentityPermissions(ctx.body.permissions),
              expiresAt: ctx.body.expires_at,
              delegationConfigId: ctx.body.delegation_config_id,
              credentialOverrides: ctx.body.credential_overrides?.map(override => ({
                credentialId: override.credential_id,
                permissions: mapIdentityPermissions(override.permissions),
                expiresAt: override.expires_at
              })),
              note: ctx.body.note,
              metadata: ctx.body.metadata
            }
          });

        return identityDelegationRequestPresenter.present({ identityDelegationRequest });
      }),

    approve: identityDelegationRequestGroup
      .post(
        instancePath(
          'identity-delegation-requests/:identityDelegationRequestId/approve',
          'identities.delegationRequests.approve'
        ),
        {
          name: 'Approve identity delegation request',
          description: 'Approves an existing identity delegation request.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .query(
        'default',
        v.object({
          allow_deleted: v.optional(
            v.boolean({
              description: 'Allow approving a request that is already deleted.',
              examples: [false]
            })
          )
        })
      )
      .output(identityDelegationRequestPresenter)
      .do(async ctx => {
        let identityDelegationRequest =
          await identityDelegationRequestService.approveIdentityDelegationRequest({
            instance: ctx.instance,
            delegationRequest: ctx.identityDelegationRequest
          });

        return identityDelegationRequestPresenter.present({ identityDelegationRequest });
      }),

    deny: identityDelegationRequestGroup
      .post(
        instancePath(
          'identity-delegation-requests/:identityDelegationRequestId/deny',
          'identities.delegationRequests.deny'
        ),
        {
          name: 'Deny identity delegation request',
          description: 'Denies an existing identity delegation request.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .query(
        'default',
        v.object({
          allow_deleted: v.optional(
            v.boolean({
              description: 'Allow denying a request that is already deleted.',
              examples: [false]
            })
          )
        })
      )
      .output(identityDelegationRequestPresenter)
      .do(async ctx => {
        let identityDelegationRequest =
          await identityDelegationRequestService.denyIdentityDelegationRequest({
            instance: ctx.instance,
            delegationRequest: ctx.identityDelegationRequest
          });

        return identityDelegationRequestPresenter.present({ identityDelegationRequest });
      })
  }
);
