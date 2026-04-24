import { badRequestError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { db, Instance, MagicMcpServer, Prisma } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { sessionClientSecretReferenceService } from '@metorial/module-access';
import { usageService } from '@metorial/module-usage';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

type RawSubspaceSession = Awaited<ReturnType<typeof subspace.session.get>>;
type MagicMcpSessionWithRelations = Prisma.MagicMcpSessionGetPayload<{
  include: {
    instance: true;
    magicMcpEndpoint: true;
    magicMcpServer: true;
  };
}>;

let enrichSessions = async (d: { instance: Instance; sessions: RawSubspaceSession[] }) => {
  if (d.sessions.length === 0) return [];

  let [references, magicMcpConnections] = await Promise.all([
    sessionClientSecretReferenceService.getForSessions({
      instance: d.instance as any,
      sessionIds: d.sessions.map(session => session.id)
    }),
    db.magicMcpSession.findMany({
      where: {
        instanceOid: d.instance.oid,
        subspaceSessionId: {
          in: d.sessions.map(session => session.id)
        }
      },
      include: {
        instance: true,
        magicMcpEndpoint: true,
        magicMcpServer: true
      }
    })
  ]);

  let referenceMap = new Map(
    references.map(
      reference => [reference.sessionId, reference.fineGrainedKey.secret] as const
    )
  );
  let magicMcpConnectionMap = new Map(
    magicMcpConnections.map(connection => [connection.subspaceSessionId, connection] as const)
  );

  return d.sessions.map(session => ({
    ...session,
    clientSecret: referenceMap.get(session.id) ?? null,
    magicMcpServer: magicMcpConnectionMap.get(session.id)?.magicMcpServer ?? null,
    magicMcpSession: magicMcpConnectionMap.get(session.id) ?? null
  }));
};

let enrichSession = async (d: { instance: Instance; session: RawSubspaceSession }) => {
  let [session] = await enrichSessions({
    instance: d.instance,
    sessions: [d.session]
  });

  return session!;
};

export let subspaceSessionService = createSubspaceService(
  subspace.session,
  ['get', 'getMany', 'list', 'create', 'update', 'delete'],
  inner => ({
    get: async (...params: Parameters<typeof inner.get>) => {
      let session = await inner.get(...params);

      return await enrichSession({
        instance: params[0].instance,
        session
      });
    },
    getMany: async (...params: Parameters<typeof inner.getMany>) => {
      let sessions = await inner.getMany(...params);

      return await enrichSessions({
        instance: params[0].instance,
        sessions
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

      return paginator.map(items =>
        enrichSessions({
          instance: input.instance,
          sessions: items
        })
      );
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

      return await enrichSession({
        instance: params[0].instance,
        session
      });
    },
    update: async (
      arg0: Parameters<typeof inner.update>[0] & { _allowMagicMcpUpdate?: boolean }
    ) => {
      let eventBase = toEventBase(arg0);

      let magicMcpLink = await db.magicMcpSession.findFirst({
        where: { subspaceSessionId: arg0.sessionId }
      });
      if (magicMcpLink && !arg0._allowMagicMcpUpdate) {
        throw new ServiceError(
          badRequestError({
            message: 'This session cannot be updated.'
          })
        );
      }

      await Fabric.fire('provider.session.updated:before', eventBase);

      let session = await inner.update(arg0);

      await Fabric.fire('provider.session.updated:after', { ...eventBase, session });

      return await enrichSession({
        instance: arg0.instance,
        session
      });
    },
    delete: async (
      arg0: Parameters<typeof inner.delete>[0] & { _allowMagicMcpDelete?: boolean }
    ) => {
      let eventBase = toEventBase(arg0);

      let magicMcpLink = await db.magicMcpSession.findFirst({
        where: { subspaceSessionId: arg0.sessionId }
      });
      if (magicMcpLink && !arg0._allowMagicMcpDelete) {
        throw new ServiceError(
          badRequestError({
            message: 'This session cannot be deleted.'
          })
        );
      }

      await Fabric.fire('provider.session.deleted:before', eventBase);

      let session = await inner.delete(arg0);

      await Fabric.fire('provider.session.deleted:after', { ...eventBase, session });

      return await enrichSession({
        instance: arg0.instance,
        session
      });
    }
  })
);

export type SubspaceSession = RawSubspaceSession & {
  clientSecret?: string | null;
  magicMcpServer?: MagicMcpServer | null;
  magicMcpSession?: MagicMcpSessionWithRelations | null;
};
