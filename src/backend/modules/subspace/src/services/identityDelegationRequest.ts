import { getSentry } from '@mtsrc/sentry';
import { usageService } from '@metorial/module-usage';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceIdentityDelegationRequestService = createSubspaceService(
  subspace.identityDelegationRequest,
  ['get', 'list', 'create', 'approve', 'deny'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      let identityDelegationRequest = await inner.create(...params);

      usageService
        .ingestUsageRecord({
          owner: {
            id: eventBase.instance.id,
            type: 'instance'
          },
          entity: {
            id: identityDelegationRequest.requester.id,
            type: 'identity_actor'
          },
          type: 'identity_actor.used'
        })
        .catch(e => Sentry.captureException(e));

      usageService
        .ingestUsageRecord({
          owner: {
            id: eventBase.instance.id,
            type: 'instance'
          },
          entity: {
            id: identityDelegationRequest.identityId,
            type: 'identity'
          },
          type: 'identity.used'
        })
        .catch(e => Sentry.captureException(e));

      if (identityDelegationRequest.delegation.delegationConfigId) {
        usageService
          .ingestUsageRecord({
            owner: {
              id: eventBase.instance.id,
              type: 'instance'
            },
            entity: {
              id: identityDelegationRequest.delegation.delegationConfigId,
              type: 'identity_delegation_config'
            },
            type: 'identity_delegation_config.used'
          })
          .catch(e => Sentry.captureException(e));
      }

      return identityDelegationRequest;
    }
  })
);

export type SubspaceIdentityDelegationRequest = Awaited<
  ReturnType<typeof subspace.identityDelegationRequest.get>
>;
