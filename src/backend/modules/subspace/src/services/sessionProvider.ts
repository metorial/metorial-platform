import { Fabric } from '@metorial/fabric';
import { usageService } from '@metorial/module-usage';
import { getSentry } from '@metorial/sentry';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceSessionProviderService = createSubspaceService(
  subspace.sessionProvider,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.provider.created:before', eventBase);

      let sessionProvider = await inner.create(...params);

      await Fabric.fire('provider.session.provider.created:after', {
        ...eventBase,
        sessionProvider: sessionProvider
      });

      if (sessionProvider.authConfig) {
        usageService
          .ingestUsageRecord({
            owner: {
              id: eventBase.instance.id,
              type: 'instance'
            },
            entity: {
              id: sessionProvider.authConfig.id,
              type: 'provider_oauth_config'
            },
            type: 'provider_oauth_config.used'
          })
          .catch(e => Sentry.captureException(e));
      }

      if (sessionProvider.config) {
        usageService
          .ingestUsageRecord({
            owner: {
              id: eventBase.instance.id,
              type: 'instance'
            },
            entity: {
              id: sessionProvider.config.id,
              type: 'provider_config'
            },
            type: 'provider_config.used'
          })
          .catch(e => Sentry.captureException(e));
      }

      if (sessionProvider.deployment) {
        usageService
          .ingestUsageRecord({
            owner: {
              id: eventBase.instance.id,
              type: 'instance'
            },
            entity: {
              id: sessionProvider.deployment.id,
              type: 'provider_deployment'
            },
            type: 'provider_deployment.used'
          })
          .catch(e => Sentry.captureException(e));
      }

      if (sessionProvider.providerId) {
        usageService
          .ingestUsageRecord({
            owner: {
              id: eventBase.instance.id,
              type: 'instance'
            },
            entity: {
              id: sessionProvider.providerId,
              type: 'provider'
            },
            type: 'provider.used'
          })
          .catch(e => Sentry.captureException(e));
      }

      return sessionProvider;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.provider.updated:before', eventBase);

      let sessionProvider = await inner.update(...params);

      await Fabric.fire('provider.session.provider.updated:after', {
        ...eventBase,
        sessionProvider
      });

      return sessionProvider;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.provider.deleted:before', eventBase);

      let sessionProvider = await inner.delete(...params);

      await Fabric.fire('provider.session.provider.deleted:after', {
        ...eventBase,
        sessionProvider
      });

      return sessionProvider;
    }
  })
);

export type SubspaceSessionProvider = Awaited<ReturnType<typeof subspace.sessionProvider.get>>;
