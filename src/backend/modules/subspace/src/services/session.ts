import { Fabric } from '@metorial/fabric';
import { usageService } from '@metorial/module-usage';
import { getSentry } from '@metorial/sentry';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceSessionService = createSubspaceService(
  subspace.session,
  ['get', 'list', 'create', 'update'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.created:before', eventBase);

      let session = await inner.create(...params);

      await Fabric.fire('provider.session.created:after', { ...eventBase, session });

      for (let provider of session.providers) {
        if (provider.fromTemplateId) {
          usageService
            .ingestUsageRecord({
              owner: {
                id: eventBase.instance.id,
                type: 'instance'
              },
              entity: {
                id: provider.fromTemplateId,
                type: 'provider_template'
              },
              type: 'provider_template.used'
            })
            .catch(e => Sentry.captureException(e));
        }

        if (provider.authConfig) {
          usageService
            .ingestUsageRecord({
              owner: {
                id: eventBase.instance.id,
                type: 'instance'
              },
              entity: {
                id: provider.authConfig.id,
                type: 'provider_oauth_config'
              },
              type: 'provider_oauth_config.used'
            })
            .catch(e => Sentry.captureException(e));
        }

        if (provider.config) {
          usageService
            .ingestUsageRecord({
              owner: {
                id: eventBase.instance.id,
                type: 'instance'
              },
              entity: {
                id: provider.config.id,
                type: 'provider_config'
              },
              type: 'provider_config.used'
            })
            .catch(e => Sentry.captureException(e));
        }

        if (provider.deployment) {
          usageService
            .ingestUsageRecord({
              owner: {
                id: eventBase.instance.id,
                type: 'instance'
              },
              entity: {
                id: provider.deployment.id,
                type: 'provider_deployment'
              },
              type: 'provider_deployment.used'
            })
            .catch(e => Sentry.captureException(e));
        }

        if (provider.providerId) {
          usageService
            .ingestUsageRecord({
              owner: {
                id: eventBase.instance.id,
                type: 'instance'
              },
              entity: {
                id: provider.providerId,
                type: 'provider'
              },
              type: 'provider.used'
            })
            .catch(e => Sentry.captureException(e));
        }
      }

      return session;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.updated:before', eventBase);

      let session = await inner.update(...params);

      await Fabric.fire('provider.session.updated:after', { ...eventBase, session });

      return session;
    }
  })
);

export type SubspaceSession = Awaited<ReturnType<typeof subspace.session.get>>;
