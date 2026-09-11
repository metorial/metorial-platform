import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { db, snowflake } from '@metorial-subspace/db';
import type {
  GetDecryptedAuthConfigParam,
  GetDecryptedAuthConfigRes,
  GetProviderAuthConfigScopesParam,
  GetProviderAuthConfigScopesRes,
  GetProviderAuthCredentialsScopesParam,
  GetProviderAuthCredentialsScopesRes,
  ProviderAuthConfigCreateParam,
  ProviderAuthConfigCreateRes,
  ProviderAuthConfigDeleteParam,
  ProviderAuthConfigDeleteRes,
  ProviderAuthCredentialsCreateParam,
  ProviderAuthCredentialsCreateRes,
  ProviderAuthCredentialsDeleteParam,
  ProviderAuthCredentialsDeleteRes,
  ProviderAuthCredentialsUpdateParam,
  ProviderAuthCredentialsUpdateRes,
  ProviderOAuthSetupCreateParam,
  ProviderOAuthSetupCreateRes,
  ProviderOAuthSetupRetrieveParam,
  ProviderOAuthSetupRetrieveRes
} from '@metorial-subspace/provider-utils';
import { IProviderAuth } from '@metorial-subspace/provider-utils';
import { getTenantForShuttle, shuttle } from '../client';

export class ProviderAuth extends IProviderAuth {
  override async createProviderAuthCredentials(
    data: ProviderAuthCredentialsCreateParam
  ): Promise<ProviderAuthCredentialsCreateRes> {
    if (!data.provider.defaultVariant?.shuttleServerOid) {
      throw new Error('Provider default variant does not have a shuttle associated with it');
    }

    let shuttleServer = await db.shuttleServer.findFirstOrThrow({
      where: { oid: data.provider.defaultVariant.shuttleServerOid }
    });

    let tenant = await getTenantForShuttle(data.tenant);

    let creds = await shuttle.serverOAuthCredentials.create({
      tenantId: tenant.id,
      serverId: shuttleServer.id,

      ...(data.input.type === 'oauth'
        ? {
            scopes: data.input.scopes,
            clientId: data.input.clientId,
            clientSecret: data.input.clientSecret
          }
        : {})
    });

    let shuttleOAuthCredentials = await db.shuttleOAuthCredentials.create({
      data: {
        oid: snowflake.nextId(),
        id: creds.id,
        shuttleServerOid: shuttleServer.oid,
        tenantOid: data.tenant.oid,
        projectOid: data.tenant.projectOid
      }
    });

    return {
      type: 'oauth',
      shuttleOAuthCredentials,
      isAutoRegistration: data.input.type === 'auto_registration'
    };
  }

  override async updateProviderAuthCredentials(
    _data: ProviderAuthCredentialsUpdateParam
  ): Promise<ProviderAuthCredentialsUpdateRes> {
    throw new ServiceError(
      badRequestError({
        message: 'This integration does not support authentication configuration'
      })
    );
  }

  override async deleteProviderAuthCredentials(
    data: ProviderAuthCredentialsDeleteParam
  ): Promise<ProviderAuthCredentialsDeleteRes> {
    if (!data.backing.shuttleCredentialsOid) {
      return {};
    }

    let tenant = await getTenantForShuttle(data.tenant);
    let shuttleOAuthCredentials = await db.shuttleOAuthCredentials.findUnique({
      where: { oid: data.backing.shuttleCredentialsOid }
    });
    if (!shuttleOAuthCredentials) {
      return {};
    }

    await shuttle.serverOAuthCredentials.delete({
      tenantId: tenant.id,
      serverOAuthCredentialsId: shuttleOAuthCredentials.id
    });

    return {};
  }

  override async createProviderOAuthSetup(
    data: ProviderOAuthSetupCreateParam
  ): Promise<ProviderOAuthSetupCreateRes> {
    if (!data.credentials?.shuttleCredentialsOid) {
      throw new Error('Credentials do not have associated shuttle credentials');
    }
    if (!data.provider.defaultVariant?.shuttleServerOid) {
      throw new Error('Provider default variant does not have a shuttle associated with it');
    }
    if (!data.providerVersion?.shuttleServerVersionOid) {
      throw new Error('Provider version does not have a shuttle version associated with it');
    }

    let tenant = await getTenantForShuttle(data.tenant);

    let shuttleServer = await db.shuttleServer.findFirstOrThrow({
      where: { oid: data.provider.defaultVariant.shuttleServerOid }
    });
    // let shuttleVersion = await db.shuttleServerVersion.findFirstOrThrow({
    //   where: { oid: data.providerVersion.shuttleServerVersionOid }
    // });
    let shuttleOAuthCredentials = await db.shuttleOAuthCredentials.findUniqueOrThrow({
      where: { oid: data.credentials.shuttleCredentialsOid }
    });
    let providerDeployment = data.providerDeployment
      ? await db.providerDeployment.findUnique({
          where: { oid: data.providerDeployment.oid },
          include: { serverInstanceConfiguration: true }
        })
      : null;

    let oauthSetup = await shuttle.serverOAuthSetup.create({
      tenantId: tenant.id,
      serverId: shuttleServer.id,
      serverInstanceConfigurationId: providerDeployment?.serverInstanceConfiguration?.id,
      input: data.input,
      redirectUrl: data.redirectUrl,
      serverCredentialsId: shuttleOAuthCredentials.id,
      callbackUrlOverride: data.callbackUrlOverride ?? undefined
    });

    let shuttleOAuthSetup = await db.shuttleOAuthSetup.create({
      data: {
        oid: snowflake.nextId(),
        id: oauthSetup.id,
        shuttleServerOid: shuttleServer.oid,
        tenantOid: data.tenant.oid,
        projectOid: data.tenant.projectOid
      }
    });

    if (!oauthSetup.url) {
      throw new Error('OAuth setup did not return a URL');
    }

    return {
      url: oauthSetup.url,
      shuttleOAuthSetup
    };
  }

  override async createProviderAuthConfig(
    data: ProviderAuthConfigCreateParam
  ): Promise<ProviderAuthConfigCreateRes> {
    if (!data.provider.defaultVariant?.shuttleServerOid) {
      throw new Error('Provider default variant does not have a shuttle associated with it');
    }
    if (!data.providerVersion?.shuttleServerVersionOid) {
      throw new Error('Provider version does not have a shuttle version associated with it');
    }

    let tenant = await getTenantForShuttle(data.tenant);

    let shuttleServer = await db.shuttleServer.findFirstOrThrow({
      where: { oid: data.provider.defaultVariant.shuttleServerOid }
    });
    // let shuttleVersion = await db.shuttleServerVersion.findFirstOrThrow({
    //   where: { oid: data.providerVersion.shuttleServerVersionOid }
    // });

    let validatedAuthConfig = v
      .object({
        accessToken: v.string(),
        expiresAt: v.optional(v.nullable(v.date()))
      })
      .validate(data.input);
    if (!validatedAuthConfig.success) {
      throw new ServiceError(
        badRequestError({
          message:
            'Invalid auth config input. Must include `accessToken` and optional `expiresAt`.'
        })
      );
    }

    let config = await shuttle.serverAuthConfig.create({
      tenantId: tenant.id,
      serverId: shuttleServer.id,
      config: {
        accessToken: validatedAuthConfig.value.accessToken,
        expiresAt: validatedAuthConfig.value.expiresAt?.toISOString()
      }
    });

    let shuttleAuthConfig = await db.shuttleAuthConfig.create({
      data: {
        oid: snowflake.nextId(),
        id: config.id,
        shuttleServerOid: shuttleServer.oid,
        tenantOid: data.tenant.oid,
        projectOid: data.tenant.projectOid
      }
    });

    return {
      shuttleAuthConfig,
      expiresAt: validatedAuthConfig.value.expiresAt ?? null
    };
  }

  override async deleteProviderAuthConfig(
    data: ProviderAuthConfigDeleteParam
  ): Promise<ProviderAuthConfigDeleteRes> {
    if (!data.backing.shuttleAuthConfigOid) {
      return {};
    }

    let tenant = await getTenantForShuttle(data.tenant);
    let shuttleAuthConfig = await db.shuttleAuthConfig.findUnique({
      where: { oid: data.backing.shuttleAuthConfigOid }
    });
    if (!shuttleAuthConfig) {
      return {};
    }

    await shuttle.serverAuthConfig.delete({
      tenantId: tenant.id,
      serverAuthConfigId: shuttleAuthConfig.id
    });

    return {};
  }

  override async retrieveProviderOAuthSetup(
    data: ProviderOAuthSetupRetrieveParam
  ): Promise<ProviderOAuthSetupRetrieveRes> {
    if (!data.setup.shuttleOAuthSetupOid) {
      throw new Error('Setup does not have associated shuttle OAuth setup');
    }

    let setup = await db.shuttleOAuthSetup.findUniqueOrThrow({
      where: { oid: data.setup.shuttleOAuthSetupOid }
    });

    let record = await shuttle.serverOAuthSetup.getLogsSync({
      serverOAuthSetupId: setup.id
    });

    let shuttleAuthConfig = record.authConfig
      ? await db.shuttleAuthConfig.upsert({
          where: { id: record.authConfig.id },
          create: {
            oid: snowflake.nextId(),
            id: record.authConfig.id,
            shuttleServerOid: setup.shuttleServerOid,
            tenantOid: data.tenant.oid,
            projectOid: data.tenant.projectOid
          },
          update: {}
        })
      : null;

    let lastFailedEvent = [...record.events]
      .reverse()
      .find(event => event.type.endsWith('_failed'));
    let status = record.status;
    if (status !== 'completed' && status !== 'pending' && status !== 'failed') {
      throw new Error(`Unknown Shuttle OAuth setup status: ${status}`);
    }

    return {
      shuttleOAuthSetup: setup,
      shuttleAuthConfig,
      status,
      url: record.url,
      error:
        record.status === 'failed'
          ? {
              code: lastFailedEvent?.type ?? 'oauth_setup_failed',
              message: lastFailedEvent?.message ?? 'OAuth setup failed'
            }
          : null
    };
  }

  override async getDecryptedAuthConfig(
    data: GetDecryptedAuthConfigParam
  ): Promise<GetDecryptedAuthConfigRes> {
    let tenant = await getTenantForShuttle(data.tenant);

    if (!data.authConfigVersion.shuttleAuthConfigOid) {
      throw new Error('Auth config does not have associated shuttle auth config');
    }

    let shuttleAuthConfig = await db.shuttleAuthConfig.findUniqueOrThrow({
      where: { oid: data.authConfigVersion.shuttleAuthConfigOid }
    });

    let record = await shuttle.serverAuthConfig.decrypt({
      tenantId: tenant.id,
      serverAuthConfigId: shuttleAuthConfig.id,
      note: data.note
    });

    return {
      decryptedConfigData: record.decryptedAuthConfig,
      expiresAt: record.decryptedAuthConfig.expiresAt
    };
  }

  override async getProviderAuthCredentialsScopes(
    _data: GetProviderAuthCredentialsScopesParam
  ): Promise<GetProviderAuthCredentialsScopesRes> {
    return { scopes: [] };
  }

  override async getProviderAuthConfigScopes(
    _data: GetProviderAuthConfigScopesParam
  ): Promise<GetProviderAuthConfigScopesRes> {
    return { scopes: [] };
  }
}
