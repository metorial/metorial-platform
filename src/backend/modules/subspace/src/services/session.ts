import { badRequestError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { db, Instance } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { sessionClientSecretReferenceService } from '@metorial/module-access';
import { usageService } from '@metorial/module-usage';
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
  ['get', 'list', 'create', 'update', 'delete'],
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
            sessionIds: res.items.map((item: RawSubspaceSession) => item.id)
          });
          let referenceMap = new Map(
            (references as any[]).map(reference => [
              String(reference.sessionId),
              String(reference.fineGrainedKey.secret)
            ])
          );

          return {
            ...res,
            items: res.items.map((item: RawSubspaceSession) => ({
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
                type: 'provider_auth_config'
              },
              type: 'provider_auth_config.used'
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
    update: async (
      arg0: Parameters<typeof inner.update>[0] & { _allowMagicMcpUpdate?: boolean }
    ) => {
      let eventBase = toEventBase(arg0);
      await Fabric.fire('provider.session.updated:before', eventBase);

      let magicMcpLink = await db.magicMcpSubspaceSessionConnection.findFirst({
        where: { subspaceSessionId: arg0.sessionId }
      });
      if (magicMcpLink && !arg0._allowMagicMcpUpdate) {
        throw new ServiceError(
          badRequestError({
            message: 'This session cannot be updated.'
          })
        );
      }

      let session = await inner.update(arg0);

      await Fabric.fire('provider.session.updated:after', { ...eventBase, session });

      return await enrichSessionWithClientSecret({
        instance: arg0.instance,
        session
      });
    },
    delete: async (
      arg0: Parameters<typeof inner.delete>[0] & { _allowMagicMcpDelete?: boolean }
    ) => {
      let eventBase = toEventBase(arg0);
      await Fabric.fire('provider.session.deleted:before', eventBase);

      let magicMcpLink = await db.magicMcpSubspaceSessionConnection.findFirst({
        where: { subspaceSessionId: arg0.sessionId }
      });
      if (magicMcpLink && !arg0._allowMagicMcpDelete) {
        throw new ServiceError(
          badRequestError({
            message: 'This session cannot be deleted.'
          })
        );
      }

      let session = await inner.delete(arg0);

      await Fabric.fire('provider.session.deleted:after', { ...eventBase, session });

      return await enrichSessionWithClientSecret({
        instance: arg0.instance,
        session
      });
    }
  })
);

export type SubspaceSession = RawSubspaceSession & {
  clientSecret?: string | null;
};
