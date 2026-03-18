import { getSentry } from '@lowerdeck/sentry';
import { usageService } from '@metorial/module-usage';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceIdentityService = createSubspaceService(
  subspace.identity,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      let identity = await inner.create(...params);

      usageService
        .ingestUsageRecord({
          owner: {
            id: eventBase.instance.id,
            type: 'instance'
          },
          entity: {
            id: identity.owner.actor.id,
            type: 'identity_actor'
          },
          type: 'identity_actor.used'
        })
        .catch(e => Sentry.captureException(e));

      if (identity.delegationConfigId) {
        usageService
          .ingestUsageRecord({
            owner: {
              id: eventBase.instance.id,
              type: 'instance'
            },
            entity: {
              id: identity.delegationConfigId,
              type: 'identity_delegation_config'
            },
            type: 'identity_delegation_config.used'
          })
          .catch(e => Sentry.captureException(e));
      }

      for (let credential of identity.credentials) {
        if (credential.delegationConfigId) {
          usageService
            .ingestUsageRecord({
              owner: {
                id: eventBase.instance.id,
                type: 'instance'
              },
              entity: {
                id: credential.delegationConfigId,
                type: 'identity_delegation_config'
              },
              type: 'identity_delegation_config.used'
            })
            .catch(e => Sentry.captureException(e));
        }
      }

      return identity;
    }
  })
);

export type SubspaceIdentity = Awaited<ReturnType<typeof subspace.identity.get>>;
