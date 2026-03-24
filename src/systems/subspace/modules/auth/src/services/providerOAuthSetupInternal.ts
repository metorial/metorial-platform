import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type ProviderOAuthSetup,
  withTransaction
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../env';
import { providerOAuthSetupUpdatedQueue } from '../queues/lifecycle/providerOAuthSetup';
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';
import { providerSetupSessionInternalService } from './providerSetupSessionInternal';

let include = {};

let syncLock = createLock({
  name: 'sub/auth/setupInternal/sync',
  redisUrl: env.service.REDIS_URL
});

class providerOAuthSetupInternalServiceImpl {
  async getProviderOAuthSetupByClientSecret(d: { setupId: string; clientSecret: string }) {
    let providerOAuthSetup = await db.providerOAuthSetup.findFirst({
      where: {
        id: d.setupId,
        clientSecret: d.clientSecret,
        expiresAt: { gt: new Date() }
      },
      include
    });
    if (!providerOAuthSetup) throw new ServiceError(notFoundError('provider.oauth_setup'));

    return providerOAuthSetup;
  }

  async handleOAuthSetupResponse(d: {
    providerOAuthSetup: ProviderOAuthSetup;
    context: {
      ip: string;
      ua: string;
    };
  }) {
    return syncLock.usingLock(d.providerOAuthSetup.id, () =>
      withTransaction(async db => {
        let providerOAuthSetup = await db.providerOAuthSetup.findUniqueOrThrow({
          where: { oid: d.providerOAuthSetup.oid },
          include: {
            authCredentials: true,
            tenant: true,
            authMethod: true,
            provider: true,
            deployment: true,
            solution: true,
            providerSetupSession: true,
            environment: true,
            authConfig: true
          }
        });

        let backend = await getBackend({ entity: providerOAuthSetup.authCredentials });

        let record = await backend.auth.retrieveProviderOAuthSetup({
          tenant: providerOAuthSetup.tenant,
          setup: providerOAuthSetup
        });

        let authConfig = providerOAuthSetup.authConfig;

        if (record.slateAuthConfig || record.shuttleAuthConfig) {
          authConfig =
            await providerAuthConfigInternalService.createProviderAuthConfigInternal({
              backend: backend.backend,
              source: providerOAuthSetup.providerSetupSession ? 'setup_session' : 'system',
              type: 'oauth_automated',
              tenant: providerOAuthSetup.tenant,
              environment: providerOAuthSetup.environment,
              solution: providerOAuthSetup.solution,
              provider: providerOAuthSetup.provider,
              providerDeployment: providerOAuthSetup.deployment ?? undefined,
              credentials: providerOAuthSetup.authCredentials,
              input: {
                name: providerOAuthSetup.name ?? undefined,
                description: providerOAuthSetup.description ?? undefined,
                metadata: providerOAuthSetup.metadata ?? undefined,
                isEphemeral: providerOAuthSetup.isEphemeral,
                isDefault: false
              },
              authMethod: providerOAuthSetup.authMethod,
              backendProviderAuthConfig: {
                slateAuthConfig: record.slateAuthConfig ?? undefined,
                shuttleAuthConfig: record.shuttleAuthConfig ?? undefined,
                expiresAt: null
              }
            });
        }

        let setup = await db.providerOAuthSetup.update({
          where: { oid: providerOAuthSetup.oid },
          data: {
            status:
              record.status === 'failed'
                ? 'failed'
                : record.status === 'completed'
                  ? 'completed'
                  : undefined,

            errorCode: record.error?.code,
            errorMessage: record.error?.message ?? record.error?.code,

            slateOAuthSetupOid: record.slateOAuthSetup?.oid,
            shuttleOAuthSetupOid: record.shuttleOAuthSetup?.oid,

            authConfigOid: authConfig?.oid ?? null
          }
        });

        let session = await db.providerSetupSession.findFirst({
          where: {
            oauthSetupOid: providerOAuthSetup.oid,
            status: { notIn: ['completed', 'expired', 'archived', 'deleted'] }
          }
        });
        if (session) {
          setup = await providerSetupSessionInternalService.oauthSetupCompleted({
            session,
            setup,
            context: d.context
          });
        }

        addAfterTransactionHook(async () =>
          providerOAuthSetupUpdatedQueue.add({ providerOAuthSetupId: setup.id })
        );

        return {
          ...setup,
          session
        };
      })
    );
  }
}

export let providerOAuthSetupInternalService = Service.create(
  'providerOAuthSetup',
  () => new providerOAuthSetupInternalServiceImpl()
).build();
