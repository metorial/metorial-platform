import { badRequestError, ServiceError } from '@lowerdeck/error';
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
import { getTenantForSlates, slates } from '../client';

export class ProviderAuth extends IProviderAuth {
  override async createProviderAuthCredentials(
    data: ProviderAuthCredentialsCreateParam
  ): Promise<ProviderAuthCredentialsCreateRes> {
    if (data.input.type !== 'oauth') {
      throw new ServiceError(
        badRequestError({
          message: 'Only oauth credentials are supported by this provider'
        })
      );
    }

    if (!data.provider.defaultVariant?.slateOid) {
      throw new Error('Provider default variant does not have a slate associated with it');
    }

    let slate = await db.slate.findFirstOrThrow({
      where: { oid: data.provider.defaultVariant.slateOid }
    });

    let tenant = await getTenantForSlates(data.tenant);

    let creds = await slates.slateOAuthCredentials.create({
      tenantId: tenant.id,
      slateId: slate.id,

      scopes: data.input.scopes,
      clientId: data.input.clientId,
      clientSecret: data.input.clientSecret
    });

    let slateOAuthCredentials = await db.slateOAuthCredentials.create({
      data: {
        oid: snowflake.nextId(),
        id: creds.id,
        slateOid: slate.oid,
        tenantOid: data.tenant.oid
      }
    });

    return {
      slateOAuthCredentials,
      isAutoRegistration: false,
      type: 'oauth'
    };
  }

  override async createProviderOAuthSetup(
    data: ProviderOAuthSetupCreateParam
  ): Promise<ProviderOAuthSetupCreateRes> {
    if (!data.credentials.slateCredentialsOid) {
      throw new Error('Credentials do not have associated slate credentials');
    }
    if (!data.provider.defaultVariant?.slateOid) {
      throw new Error('Provider default variant does not have a slate associated with it');
    }
    if (!data.providerVersion?.slateVersionOid) {
      throw new Error('Provider version does not have a slate version associated with it');
    }

    let tenant = await getTenantForSlates(data.tenant);

    let slate = await db.slate.findFirstOrThrow({
      where: { oid: data.provider.defaultVariant.slateOid }
    });
    let slateVersion = await db.slateVersion.findFirstOrThrow({
      where: { oid: data.providerVersion.slateVersionOid }
    });
    let slateOAuthCredentials = await db.slateOAuthCredentials.findUniqueOrThrow({
      where: { oid: data.credentials.slateCredentialsOid }
    });

    let oauthSetup = await slates.slateOAuthSetup.create({
      tenantId: tenant.id,
      slateId: slate.id,
      slateVersionId: slateVersion.id,

      input: data.input,
      redirectUrl: data.redirectUrl,
      slateOAuthCredentialsId: slateOAuthCredentials.id,
      callbackUrlOverride: data.callbackUrlOverride ?? undefined
    });

    let slateOAuthSetup = await db.slateOAuthSetup.create({
      data: {
        oid: snowflake.nextId(),
        id: oauthSetup.id,
        slateOid: slate.oid,
        tenantOid: data.tenant.oid
      }
    });

    if (!oauthSetup.url) {
      throw new Error('OAuth setup did not return a URL');
    }

    return {
      url: oauthSetup.url,
      slateOAuthSetup
    };
  }

  override async createProviderAuthConfig(
    data: ProviderAuthConfigCreateParam
  ): Promise<ProviderAuthConfigCreateRes> {
    if (!data.provider.defaultVariant?.slateOid) {
      throw new Error('Provider default variant does not have a slate associated with it');
    }
    if (!data.providerVersion?.slateVersionOid) {
      throw new Error('Provider version does not have a slate version associated with it');
    }

    let tenant = await getTenantForSlates(data.tenant);

    let slate = await db.slate.findFirstOrThrow({
      where: { oid: data.provider.defaultVariant.slateOid }
    });
    let slateVersion = await db.slateVersion.findFirstOrThrow({
      where: { oid: data.providerVersion.slateVersionOid }
    });

    let config = await slates.slateAuthConfig.create({
      tenantId: tenant.id,
      slateId: slate.id,
      slateVersionId: slateVersion.id,
      authMethodId: data.authMethod.value.callableId,
      authConfig: data.input
    });

    let slateAuthConfig = await db.slateAuthConfig.create({
      data: {
        oid: snowflake.nextId(),
        id: config.id,
        slateOid: slate.oid,
        tenantOid: data.tenant.oid
      }
    });

    return {
      slateAuthConfig,
      expiresAt: config.tokenExpiresAt
    };
  }

  override async retrieveProviderOAuthSetup(
    data: ProviderOAuthSetupRetrieveParam
  ): Promise<ProviderOAuthSetupRetrieveRes> {
    if (!data.setup.slateOAuthSetupOid) {
      throw new Error('Setup does not have associated slate OAuth setup');
    }

    let tenant = await getTenantForSlates(data.tenant);
    let setup = await db.slateOAuthSetup.findUniqueOrThrow({
      where: { oid: data.setup.slateOAuthSetupOid }
    });

    let record = await slates.slateOAuthSetup.get({
      tenantId: tenant.id,
      slateOAuthSetupId: setup.id
    });

    let slateAuthConfig = record.authConfig
      ? await db.slateAuthConfig.upsert({
          where: { id: record.authConfig.id },
          create: {
            oid: snowflake.nextId(),
            id: record.authConfig.id,
            slateOid: setup.slateOid,
            tenantOid: data.tenant.oid
          },
          update: {}
        })
      : null;

    return {
      slateOAuthSetup: setup,
      slateAuthConfig,
      status: {
        completed: 'completed' as const,
        opened: 'pending' as const,
        unused: 'pending' as const,
        failed: 'failed' as const
      }[record.status],
      url: record.url,
      error: record.error
    };
  }

  override async getDecryptedAuthConfig(
    data: GetDecryptedAuthConfigParam
  ): Promise<GetDecryptedAuthConfigRes> {
    let tenant = await getTenantForSlates(data.tenant);

    if (!data.authConfigVersion.slateAuthConfigOid) {
      throw new Error('Auth config does not have associated slate auth config');
    }

    let slateAuthConfig = await db.slateAuthConfig.findUniqueOrThrow({
      where: { oid: data.authConfigVersion.slateAuthConfigOid }
    });

    let record = await slates.slateAuthConfig.decrypt({
      tenantId: tenant.id,
      slateAuthConfigId: slateAuthConfig.id,
      note: data.note
    });

    return {
      decryptedConfigData: record.decryptedAuthConfig,
      expiresAt: record.authConfig.tokenExpiresAt
    };
  }
}
