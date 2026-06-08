import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  getOAuthCallbackUrl,
  ID,
  type Provider,
  type ProviderAuthCredentials,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderOAuthSetup,
  type ProviderType,
  type ProviderVariant,
  type ProviderVersion,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import { checkProviderMatch } from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { addMinutes } from 'date-fns';
import { env } from '../env';
import {
  providerOAuthSetupCreatedQueue,
  providerOAuthSetupUpdatedQueue
} from '../queues/lifecycle/providerOAuthSetup';
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';
import { providerAuthCredentialsService } from './providerAuthCredentials';

let include = {
  provider: true,
  deployment: true,
  authCredentials: true,
  authConfig: { include: { deployment: true } },
  authMethod: { include: { specification: { omit: { value: true } } } }
};

export let providerOAuthSetupInclude = include;

class providerOAuthSetupServiceImpl {
  async listProviderOAuthSetups(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    allowDeleted?: boolean;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerOAuthSetup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              isEphemeral: false,
              ...normalizeStatusForList(d).onlyParent
            },
            include
          })
      )
    );
  }

  async getProviderOAuthSetupById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerOAuthSetupId: string;
    allowDeleted?: boolean;
  }) {
    let providerOAuthSetup = await db.providerOAuthSetup.findFirst({
      where: {
        id: d.providerOAuthSetupId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!providerOAuthSetup)
      throw new ServiceError(notFoundError('provider.oauth_setup', d.providerOAuthSetupId));

    return providerOAuthSetup;
  }

  async createProviderOAuthSetup(d: {
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
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
      isEphemeral?: boolean;
      isDefault?: boolean;
      authMethodId?: string;
      redirectUrl?: string;
      config: Record<string, any>;
      expiresAt?: Date;
    };
  }) {
    checkTenant(d, d.providerDeployment);
    checkTenant(d, d.credentials);

    checkDeletedRelation(d.providerDeployment, { allowEphemeral: d.input.isEphemeral });

    checkProviderMatch(d.provider, d.credentials);
    checkProviderMatch(d.provider, d.providerDeployment);

    if (
      !d.credentials &&
      d.provider.type.attributes.auth.oauth?.oauthAutoRegistration?.status !== 'supported'
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'No provider auth credentials provided for oauth method',
          code: 'missing_auth_credentials'
        })
      );
    }

    let credentials = d.credentials;

    if (!credentials) {
      credentials = await providerAuthCredentialsService.ensureDefaultProviderAuthCredentials({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        provider: d.provider
      });
    }

    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let { version, authMethod } =
        await providerAuthConfigInternalService.getVersionAndAuthMethod({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          provider: d.provider,
          providerDeployment: d.providerDeployment,
          authMethodId: d.input.authMethodId,
          credentials
        });

      if (authMethod.type !== 'oauth') {
        throw new ServiceError(
          badRequestError({
            message: d.input.authMethodId
              ? 'Invalid auth method for provider'
              : 'Provider has no OAuth auth method',
            code: d.input.authMethodId ? 'invalid_auth_method' : 'missing_oauth_method'
          })
        );
      }

      let backend = await getBackend({
        entity: d.provider.defaultVariant!
      });

      if (!credentials) {
        throw new Error('Provider auth credentials are required');
      }

      credentials =
        await providerAuthCredentialsService.getProviderAuthCredentialsForBackendUse({
          tenant: d.tenant,
          solution: d.solution,
          provider: d.provider,
          providerAuthCredentials: credentials,
          providerAuthMethod: authMethod
        });

      let newId = getId('providerOAuthSetup');
      let clientSecret = await ID.generateId('providerOAuthSetup_clientSecret');

      let isManagedCredentials =
        credentials.origin === 'managed_backing' || credentials.origin === 'managed_public';

      let callbackUrlOverride = isManagedCredentials
        ? null
        : await getOAuthCallbackUrl(d.provider.type, d.provider, d.tenant);

      let backendProviderOAuthSetup = await backend.auth.createProviderOAuthSetup({
        tenant: d.tenant,
        provider: d.provider,
        providerVersion: version,
        providerDeployment: d.providerDeployment,
        input: d.input.config,
        credentials,
        authMethod,
        callbackUrlOverride,
        redirectUrl: `${env.service.PUBLIC_SERVICE_URL}/oauth-setup/${newId.id}/callback?client_secret=${clientSecret}`
      });

      let providerOAuthSetup = await db.providerOAuthSetup.create({
        data: {
          ...newId,
          clientSecret,

          status: 'unused',

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,
          toolFilter: d.input.toolFilters ?? { type: 'v1.allow_all' },

          isEphemeral: !!d.input.isEphemeral,

          redirectUrl: d.input.redirectUrl,
          backendUrl: backendProviderOAuthSetup.url,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          providerOid: d.provider.oid,
          deploymentOid: d.providerDeployment?.oid,
          authCredentialsOid: credentials.oid,
          authMethodOid: authMethod.oid,

          slateOAuthSetupOid: backendProviderOAuthSetup.slateOAuthSetup?.oid,
          shuttleOAuthSetupOid: backendProviderOAuthSetup.shuttleOAuthSetup?.oid,

          expiresAt: addMinutes(new Date(), 30)
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerOAuthSetupCreatedQueue.add({ providerOAuthSetupId: providerOAuthSetup.id })
      );

      return providerOAuthSetup;
    });
  }

  async updateProviderOAuthSetup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerOAuthSetup: ProviderOAuthSetup;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.providerOAuthSetup);

    return withTransaction(async db => {
      let config = await db.providerOAuthSetup.update({
        where: {
          oid: d.providerOAuthSetup.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.providerOAuthSetup.name,
          description: d.input.description ?? d.providerOAuthSetup.description,
          metadata: d.input.metadata ?? d.providerOAuthSetup.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerOAuthSetupUpdatedQueue.add({ providerOAuthSetupId: config.id })
      );

      return config;
    });
  }
}

export let providerOAuthSetupService = Service.create(
  'providerOAuthSetup',
  () => new providerOAuthSetupServiceImpl()
).build();
