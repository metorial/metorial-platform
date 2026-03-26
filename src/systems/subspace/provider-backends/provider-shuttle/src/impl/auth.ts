import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { db, snowflake } from '@metorial-subspace/db';
import type {
  GetDecryptedAuthConfigParam,
  GetDecryptedAuthConfigRes,
  ProviderAuthConfigCreateParam,
  ProviderAuthConfigCreateRes,
  ProviderAuthCredentialsCreateParam,
  ProviderAuthCredentialsCreateRes,
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
        tenantOid: data.tenant.oid
      }
    });

    return {
      type: 'oauth',
      shuttleOAuthCredentials,
      isAutoRegistration: data.input.type === 'auto_registration'
    };
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

    let oauthSetup = await shuttle.serverOAuthSetup.create({
      tenantId: tenant.id,
      serverId: shuttleServer.id,
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
        tenantOid: data.tenant.oid
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
        tenantOid: data.tenant.oid
      }
    });

    return {
      shuttleAuthConfig,
      expiresAt: validatedAuthConfig.value.expiresAt ?? null
    };
  }

  override async retrieveProviderOAuthSetup(
    data: ProviderOAuthSetupRetrieveParam
  ): Promise<ProviderOAuthSetupRetrieveRes> {
    if (!data.setup.shuttleOAuthSetupOid) {
      throw new Error('Setup does not have associated shuttle OAuth setup');
    }

    let tenant = await getTenantForShuttle(data.tenant);
    let setup = await db.shuttleOAuthSetup.findUniqueOrThrow({
      where: { oid: data.setup.shuttleOAuthSetupOid }
    });

    let record = await shuttle.serverOAuthSetup.get({
      tenantId: tenant.id,
      serverOAuthSetupId: setup.id
    });

    let shuttleAuthConfig = record.authConfig
      ? await db.shuttleAuthConfig.upsert({
          where: { id: record.authConfig.id },
          create: {
            oid: snowflake.nextId(),
            id: record.authConfig.id,
            shuttleServerOid: setup.shuttleServerOid,
            tenantOid: data.tenant.oid
          },
          update: {}
        })
      : null;

    return {
      shuttleOAuthSetup: setup,
      shuttleAuthConfig,
      status: {
        completed: 'completed' as const,
        pending: 'pending' as const,
        failed: 'failed' as const
      }[record.status],
      url: record.url,
      error: null
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
}
