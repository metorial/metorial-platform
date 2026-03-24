import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Environment,
  getId,
  type Provider,
  type ProviderAuthCredentials,
  type ProviderAuthMethod,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderOAuthSetup,
  type ProviderSetupSession,
  type ProviderType,
  type ProviderVariant,
  type ProviderVersion,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { checkProviderMatch } from '@metorial-subspace/module-provider-internal';
import { providerSetupSessionUpdatedQueue } from '../queues/lifecycle/providerSetupSession';
import { providerAuthConfigService } from './providerAuthConfig';
import { providerOAuthSetupService } from './providerOAuthSetup';

class providerSetupSessionInternalServiceImpl {
  async createProviderAuthConfig(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null; type: ProviderType };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      currentVersion:
        | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
        | null;
    };
    credentials?: ProviderAuthCredentials;
    authMethod: ProviderAuthMethod;
    expiresAt: Date;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      config: Record<string, any>;
    };
    import: {
      ip: string | undefined;
      ua: string | undefined;
    };
  }) {
    checkProviderMatch(d.provider, d.credentials);
    checkProviderMatch(d.provider, d.providerDeployment);
    checkProviderMatch(d.provider, d.authMethod);

    if (d.authMethod.type === 'oauth') {
      if (
        !d.credentials &&
        d.provider.type.attributes.auth.oauth?.oauthAutoRegistration?.status !== 'supported'
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'No provider auth credentials provided for oauth method',
            code: 'missing_oauth_credentials'
          })
        );
      }

      let setup = await providerOAuthSetupService.createProviderOAuthSetup({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        credentials: d.credentials,
        input: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          config: d.input.config,
          authMethodId: d.authMethod.id,
          expiresAt: d.expiresAt
        }
      });

      return {
        oauthSetupOid: setup.oid,
        deploymentOid: setup.deploymentOid,
        authConfigOid: setup.authConfigOid,
        authMethodOid: setup.authMethodOid,
        authCredentialsOid: setup.authCredentialsOid
      };
    } else {
      let config = await providerAuthConfigService.createProviderAuthConfig({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        import: d.import,
        source: 'setup_session',
        input: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          isEphemeral: true,
          config: d.input.config,
          authMethodId: d.authMethod.id
        }
      });

      return {
        authConfigOid: config.oid,
        deploymentOid: config.deploymentOid,
        authMethodOid: config.authMethodOid,
        authCredentialsOid: config.currentVersion.authCredentialsOid
      };
    }
  }

  async createProviderConfig(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      currentVersion:
        | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
        | null;
    };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      config: Record<string, any>;
    };
  }) {
    checkProviderMatch(d.provider, d.providerDeployment);

    let config = await providerConfigService.createProviderConfig({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      provider: d.provider,
      providerDeployment: d.providerDeployment,
      input: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        isEphemeral: true,
        config: { type: 'inline', data: d.input.config }
      }
    });

    return {
      configOid: config.oid,
      deploymentOid: config.deploymentOid
    };
  }

  async oauthSetupCompleted(d: {
    session: ProviderSetupSession;
    setup: ProviderOAuthSetup;
    context: { ip: string; ua: string };
  }) {
    return withTransaction(async db => {
      if (
        d.session.status === 'completed' ||
        d.session.status === 'archived' ||
        d.session.status === 'deleted' ||
        d.session.status === 'expired'
      )
        return d.setup;

      if (d.setup.status === 'completed') {
        await db.providerSetupSession.update({
          where: { oid: d.session.oid },
          data: {
            authCredentialsOid: d.setup.authCredentialsOid ?? undefined,
            authConfigOid: d.setup.authConfigOid ?? undefined
          }
        });

        if (d.setup.authConfigOid) {
          await db.providerAuthConfig.update({
            where: { oid: d.setup.authConfigOid },
            data: { metadata: d.session.metadata }
          });
        }

        await db.providerSetupSessionEvent.createMany({
          data: [
            {
              ...getId('providerSetupSessionEvent'),
              type: 'oauth_setup_completed',
              ip: d.context.ip,
              ua: d.context.ua,
              sessionOid: d.session.oid,
              setupOid: d.setup.oid
            },
            {
              ...getId('providerSetupSessionEvent'),
              type: 'auth_config_set',
              ip: d.context.ip,
              ua: d.context.ua,
              sessionOid: d.session.oid,
              setupOid: d.setup.oid
            }
          ]
        });

        d.setup = await db.providerOAuthSetup.update({
          where: { oid: d.setup.oid },
          data: { redirectUrl: d.session.redirectUrl }
        });
      } else {
        await db.providerSetupSession.update({
          where: { oid: d.session.oid },
          data: {
            status: 'failed',
            authCredentialsOid: d.setup.authCredentialsOid ?? undefined,
            authConfigOid: d.setup.authConfigOid ?? undefined
          }
        });

        await db.providerSetupSessionEvent.createMany({
          data: {
            ...getId('providerSetupSessionEvent'),
            type: 'oauth_setup_failed',
            ip: d.context.ip,
            ua: d.context.ua,
            sessionOid: d.session.oid,
            setupOid: d.setup.oid
          }
        });
      }

      await this.evaluate({
        session: d.session,
        context: { ip: d.context.ip, ua: d.context.ua }
      });

      addAfterTransactionHook(async () =>
        providerSetupSessionUpdatedQueue.add({ providerSetupSessionId: d.session.id })
      );

      return d.setup;
    });
  }

  async evaluate(d: { session: ProviderSetupSession; context: { ip: string; ua: string } }) {
    if (
      d.session.status === 'completed' ||
      d.session.status === 'archived' ||
      d.session.status === 'deleted' ||
      d.session.status === 'expired'
    )
      return d.session;

    return withTransaction(async db => {
      d.session = await db.providerSetupSession.findFirstOrThrow({
        where: { oid: d.session.oid }
      });

      let result = d.session;

      let hasAuthConfig = d.session.authConfigOid !== null;
      let hasConfig = d.session.configOid !== null;

      let isComplete = false;

      if (d.session.type === 'auth_only' && hasAuthConfig) isComplete = true;

      if (d.session.type === 'auth_and_config' && hasAuthConfig && hasConfig)
        isComplete = true;

      if (d.session.type === 'config_only' && hasConfig) isComplete = true;

      if (isComplete) {
        result = await db.providerSetupSession.update({
          where: { oid: d.session.oid },
          data: { status: 'completed' }
        });

        await db.providerSetupSessionEvent.createMany({
          data: [
            {
              ...getId('providerSetupSessionEvent'),
              type: 'completed',
              sessionOid: d.session.oid,
              ip: d.context.ip,
              ua: d.context.ua
            }
          ]
        });
      }

      return result;
    });
  }
}

export let providerSetupSessionInternalService = Service.create(
  'providerSetupSession',
  () => new providerSetupSessionInternalServiceImpl()
).build();
