import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  identityActorService,
  identityDelegationRequestService,
  identityService
} from '@metorial-subspace/module-identity';
import { identityDelegationRequestPresenter } from '@metorial-subspace/presenters';
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

export let identityDelegationRequestApp = tenantApp.use(async ctx => {
  let identityDelegationRequestId = ctx.body.identityDelegationRequestId;
  if (!identityDelegationRequestId) {
    throw new Error('IdentityDelegationRequest ID is required');
  }

  let delegationRequest =
    await identityDelegationRequestService.getIdentityDelegationRequestById({
      identityDelegationRequestId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { delegationRequest };
});

export let identityDelegationRequestController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(v.array(v.enumOf(['pending', 'approved', 'denied', 'canceled']))),

          ids: v.optional(v.array(v.string())),
          actorIds: v.optional(v.array(v.string())),
          identityIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await identityDelegationRequestService.listIdentityDelegationRequests({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,

        ids: ctx.input.ids,
        actorIds: ctx.input.actorIds,
        identityIds: ctx.input.identityIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, identityDelegationRequestPresenter);
    }),

  get: identityDelegationRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityDelegationRequestId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => identityDelegationRequestPresenter(ctx.delegationRequest)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        identityId: v.string(),
        requesterActorId: v.string(),
        delegatorActorId: v.optional(v.string()),

        permissions: v.optional(v.array(v.enumOf(identityPermissionValues))),
        expiresAt: v.date(),

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

      let [identity, requester, delegator] = await Promise.all([
        identityService.getIdentityById({
          ...ts,
          identityId: ctx.input.identityId
        }),
        identityActorService.getIdentityActorById({
          ...ts,
          identityActorId: ctx.input.requesterActorId
        }),
        ctx.input.delegatorActorId
          ? identityActorService.getIdentityActorById({
              ...ts,
              identityActorId: ctx.input.delegatorActorId
            })
          : Promise.resolve(undefined)
      ]);

      let delegationRequest =
        await identityDelegationRequestService.createIdentityDelegationRequest({
          ...ts,
          input: {
            identity,
            requester,
            delegator,
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

      return identityDelegationRequestPresenter(delegationRequest);
    }),

  approve: identityDelegationRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityDelegationRequestId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let delegationRequest =
        await identityDelegationRequestService.approveIdentityDelegationRequest({
          delegationRequest: ctx.delegationRequest,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution
        });

      return identityDelegationRequestPresenter(delegationRequest);
    }),

  deny: identityDelegationRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityDelegationRequestId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let delegationRequest =
        await identityDelegationRequestService.denyIdentityDelegationRequest({
          delegationRequest: ctx.delegationRequest,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution
        });

      return identityDelegationRequestPresenter(delegationRequest);
    })
});
