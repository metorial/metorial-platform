import { Instance } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { sessionClientSecretReferenceService } from '@metorial/module-access';
import { usageService } from '@metorial/module-usage';
import { getSentry } from '@metorial/sentry';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

type RawSubspaceSession = Awaited<ReturnType<typeof subspace.session.get>>;

let enrichSessionWithClientSecret = async (d: {
  instance: Instance;
  session: RawSubspaceSession;
}) => {
  let reference = await sessionClientSecretReferenceService.getForSession({
    instance: d.instance as any,
    sessionId: d.session.id
  });

  return {
    ...d.session,
    clientSecret: reference?.fineGrainedKey.secret ?? null
  };
};

export let subspaceSessionService = createSubspaceService(
  subspace.session,
  ['get', 'list', 'create', 'update'],
  inner => ({
    get: async (...params: Parameters<typeof inner.get>) => {
      let session = await inner.get(...params);

      return await enrichSessionWithClientSecret({
        instance: params[0].instance,
        session
      });
    },
    list: async (
      input: Parameters<typeof inner.list>[0] & { accessTagSessionIds?: string[] }
    ) => {
      let ids = narrowSessionIdFilter({
        allowedSessionIds: input.accessTagSessionIds,
        requestedSessionIds: input.ids
      });

      let paginator = await inner.list({
        ...input,
        ids
      });

      return {
        run: async (query: any) => {
          let res = await paginator.run(query);
          let references = await sessionClientSecretReferenceService.getForSessions({
            instance: input.instance,
            sessionIds: res.items.map(item => item.id)
          });
          let referenceMap = new Map(
            (references as any[]).map(reference => [
              String(reference.sessionId),
              String(reference.fineGrainedKey.secret)
            ])
          );

          return {
            ...res,
            items: res.items.map(item => ({
              ...item,
              clientSecret: referenceMap.get(item.id) ?? null
            }))
          };
        }
      };
    },
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.created:before', eventBase);

      let session = await inner.create(...params);
      await sessionClientSecretReferenceService.createForSession({
        instance: params[0].instance,
        sessionId: session.id
      });

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

      return await enrichSessionWithClientSecret({
        instance: params[0].instance,
        session
      });
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.updated:before', eventBase);

      let session = await inner.update(...params);

      await Fabric.fire('provider.session.updated:after', { ...eventBase, session });

      return await enrichSessionWithClientSecret({
        instance: params[0].instance,
        session
      });
    }
  })
);

export type SubspaceSession = RawSubspaceSession & {
  clientSecret?: string | null;
};
