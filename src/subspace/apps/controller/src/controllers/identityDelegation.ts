import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  identityActorService,
  identityDelegationService,
  identityService
} from '@metorial-subspace/module-identity';
import { identityDelegationPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import {
  identityPermissionValues,
  mapIdentityPermissionsToService
} from './_identityPermissions';
import { tenantApp } from './tenant';

let delegationCredentialOverrideValidator = v.object({
  credentialId: v.string(),
  permissions: v.optional(v.array(v.enumOf(identityPermissionValues))),
  expiresAt: v.optional(v.date())
});

export let identityDelegationApp = tenantApp.use(async ctx => {
  let identityDelegationId = ctx.body.identityDelegationId;
  if (!identityDelegationId) throw new Error('IdentityDelegation ID is required');

  let delegation = await identityDelegationService.getIdentityDelegationById({
    identityDelegationId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { delegation };
});

export let identityDelegationController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(
            v.array(
              v.enumOf(['waiting_for_consent', 'denied', 'active', 'revoked', 'expired'])
            )
          ),
          permissions: v.optional(v.array(v.enumOf(identityPermissionValues))),

          ids: v.optional(v.array(v.string())),
          ownerActorIds: v.optional(v.array(v.string())),
          delegatorActorIds: v.optional(v.array(v.string())),
          delegateeActorIds: v.optional(v.array(v.string())),
          identityIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await identityDelegationService.listIdentityDelegations({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,
        permissions: mapIdentityPermissionsToService(ctx.input.permissions),

        ids: ctx.input.ids,
        ownerActorIds: ctx.input.ownerActorIds,
        delegatorActorIds: ctx.input.delegatorActorIds,
        delegateeActorIds: ctx.input.delegateeActorIds,
        identityIds: ctx.input.identityIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, identityDelegationPresenter);
    }),

  get: identityDelegationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityDelegationId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => identityDelegationPresenter(ctx.delegation)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        identityId: v.string(),
        delegatorActorId: v.optional(v.string()),
        delegateeActorId: v.string(),

        permissions: v.optional(v.array(v.enumOf(identityPermissionValues))),
        expiresAt: v.optional(v.date()),

        delegationConfigId: v.optional(v.string()),
        credentialOverrides: v.optional(v.array(delegationCredentialOverrideValidator)),

        note: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let ts = {
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      };

      let [identity, delegator, delegatee] = await Promise.all([
        identityService.getIdentityById({
          ...ts,
          identityId: ctx.input.identityId
        }),
        ctx.input.delegatorActorId
          ? identityActorService.getIdentityActorById({
              ...ts,
              identityActorId: ctx.input.delegatorActorId
            })
          : Promise.resolve(undefined),
        identityActorService.getIdentityActorById({
          ...ts,
          identityActorId: ctx.input.delegateeActorId
        })
      ]);

      let delegation = await identityDelegationService.createIdentityDelegation({
        ...ts,
        input: {
          identity,
          delegator,
          delegatee,
          permissions: mapIdentityPermissionsToService(ctx.input.permissions),
          expiresAt: ctx.input.expiresAt,
          delegationConfigId: ctx.input.delegationConfigId,
          credentialOverrides: ctx.input.credentialOverrides?.map(override => ({
            credentialId: override.credentialId,
            permissions: mapIdentityPermissionsToService(override.permissions),
            expiresAt: override.expiresAt
          })),
          note: ctx.input.note,
          metadata: ctx.input.metadata
        }
      });

      return identityDelegationPresenter(delegation);
    }),

  revoke: identityDelegationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityDelegationId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let delegation = await identityDelegationService.revokeIdentityDelegation({
        delegation: ctx.delegation,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      return identityDelegationPresenter(delegation);
    })
});
