import { getSentry } from '@lowerdeck/sentry';
import { usageService } from '@metorial/module-usage';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceIdentityDelegationService = createSubspaceService(
  subspace.identityDelegation,
  ['get', 'list', 'create', 'revoke'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      let identityDelegation = await inner.create(...params);

      for (let party of identityDelegation.parties) {
        usageService
          .ingestUsageRecord({
            owner: {
              id: eventBase.instance.id,
              type: 'instance'
            },
            entity: {
              id: party.actor.id,
              type: 'identity_actor'
            },
            type: 'identity_actor.used'
          })
          .catch(e => Sentry.captureException(e));
      }

      usageService
        .ingestUsageRecord({
          owner: {
            id: eventBase.instance.id,
            type: 'instance'
          },
          entity: {
            id: identityDelegation.identity.id,
            type: 'identity'
          },
          type: 'identity.used'
        })
        .catch(e => Sentry.captureException(e));

      if (identityDelegation.delegationConfigId) {
        usageService
          .ingestUsageRecord({
            owner: {
              id: eventBase.instance.id,
              type: 'instance'
            },
            entity: {
              id: identityDelegation.delegationConfigId,
              type: 'identity_delegation_config'
            },
            type: 'identity_delegation_config.used'
          })
          .catch(e => Sentry.captureException(e));
      }

      return identityDelegation;
    }
  })
);

export type SubspaceIdentityDelegation = Awaited<
  ReturnType<typeof subspace.identityDelegation.get>
>;
