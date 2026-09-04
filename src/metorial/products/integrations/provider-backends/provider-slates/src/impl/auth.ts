import { badRequestError, ServiceError } from '@lowerdeck/error';
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
  ProviderAuthConfigVersionCreatedParam,
  ProviderAuthConfigVersionCreatedRes,
  ProviderAuthCredentialsCreateParam,
  ProviderAuthCredentialsCreateRes,
  ProviderAuthCredentialsDeleteParam,
  ProviderAuthCredentialsDeleteRes,
  ProviderAuthCredentialsScopesParam,
  ProviderAuthCredentialsScopesRes,
  ProviderAuthCredentialsUpdateParam,
  ProviderAuthCredentialsUpdateRes,
  ProviderOAuthSetupCreateParam,
  ProviderOAuthSetupCreateRes,
  ProviderOAuthSetupRetrieveParam,
  ProviderOAuthSetupRetrieveRes
} from '@metorial-subspace/provider-utils';
import { IProviderAuth } from '@metorial-subspace/provider-utils';
import { getTenantForSlates, slates } from '../client';
import { enqueueAuthConfigProcessingSync } from '../queues/sync/authConfigProcessing';
import { resolveSlateAuthConfigScopes } from './scopes';

export class ProviderAuth extends IProviderAuth {
  override async onProviderAuthConfigVersionCreated(
    data: ProviderAuthConfigVersionCreatedParam
  ): Promise<ProviderAuthConfigVersionCreatedRes> {
    if (!data.authConfigVersion.slateAuthConfigOid) return {};

    await enqueueAuthConfigProcessingSync({
      providerAuthConfigId: data.authConfig.id,
      providerAuthConfigVersionId: data.authConfigVersion.id
    });

    return {};
  }

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
        tenantOid: data.tenant.oid,
        projectOid: data.tenant.projectOid
      }
    });

    return {
      slateOAuthCredentials,
      isAutoRegistration: false,
      type: 'oauth'
    };
  }

  override async updateProviderAuthCredentials(
    data: ProviderAuthCredentialsUpdateParam
  ): Promise<ProviderAuthCredentialsUpdateRes> {
    if (!data.backing.slateCredentialsOid) {
      return {};
    }

    let tenant = await getTenantForSlates(data.tenant);
    let slateOAuthCredentials = await db.slateOAuthCredentials.findUnique({
      where: { oid: data.backing.slateCredentialsOid }
    });
    if (!slateOAuthCredentials) {
      return {};
    }

    await slates.slateOAuthCredentials.update({
      tenantId: tenant.id,
      slateOAuthCredentialsId: slateOAuthCredentials.id,

      clientId: data.input.clientId,
      clientSecret: data.input.clientSecret,
      scopes: data.input.scopes
    });

    return {};
  }

  override async deleteProviderAuthCredentials(
    data: ProviderAuthCredentialsDeleteParam
  ): Promise<ProviderAuthCredentialsDeleteRes> {
    if (!data.backing.slateCredentialsOid) {
      return {};
    }

    let tenant = await getTenantForSlates(data.tenant);
    let slateOAuthCredentials = await db.slateOAuthCredentials.findUnique({
      where: { oid: data.backing.slateCredentialsOid }
    });
    if (!slateOAuthCredentials) {
      return {};
    }

    await slates.slateOAuthCredentials.delete({
      tenantId: tenant.id,
      slateOAuthCredentialsId: slateOAuthCredentials.id
    });

    return {};
  }

  override async getManyProviderAuthCredentialsScopes(
    data: ProviderAuthCredentialsScopesParam
  ): Promise<ProviderAuthCredentialsScopesRes> {
    let oids = data.backings
      .filter(b => b.slateCredentialsOid)
      .map(b => b.slateCredentialsOid!);

    if (oids.length === 0) return { scopes: new Map() };

    let slateRows = await db.slateOAuthCredentials.findMany({
      where: { oid: { in: oids } }
    });
    if (slateRows.length === 0) return { scopes: new Map() };

    let tenant = await getTenantForSlates(data.tenant);
    let slateCreds = await slates.slateOAuthCredentials.getMany({
      tenantId: tenant.id,
      slateOAuthCredentialsIds: slateRows.map(r => r.id)
    });

    let slateIdToOid = new Map(slateRows.map(r => [r.id, r.oid]));
    let oidToBackingId = new Map(
      data.backings.filter(b => b.slateCredentialsOid).map(b => [b.slateCredentialsOid!, b.id])
    );

    let scopes = new Map<string, string[]>();
    for (let cred of slateCreds) {
      let oid = slateIdToOid.get(cred.id);
      if (!oid) continue;
      let backingId = oidToBackingId.get(oid);
      if (!backingId) continue;
      scopes.set(backingId, cred.scopes);
    }

    return { scopes };
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
    let providerDeployment = data.providerDeployment
      ? await db.providerDeployment.findUnique({
          where: { oid: data.providerDeployment.oid },
          include: { slateInstanceConfiguration: true }
        })
      : null;

    let oauthSetup = await slates.slateOAuthSetup.create({
      tenantId: tenant.id,
      slateId: slate.id,
      slateVersionId: slateVersion.id,
      slateInstanceConfigurationId: providerDeployment?.slateInstanceConfiguration?.id,
      authMethodId: data.authMethod.specId,

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
        tenantOid: data.tenant.oid,
        projectOid: data.tenant.projectOid
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
      authMethodId: data.authMethod.specId,
      authConfig: data.input
    });

    let slateAuthConfig = await db.slateAuthConfig.create({
      data: {
        oid: snowflake.nextId(),
        id: config.id,
        slateOid: slate.oid,
        tenantOid: data.tenant.oid,
        projectOid: data.tenant.projectOid
      }
    });

    return {
      slateAuthConfig,
      expiresAt: config.tokenExpiresAt
    };
  }

  override async deleteProviderAuthConfig(
    data: ProviderAuthConfigDeleteParam
  ): Promise<ProviderAuthConfigDeleteRes> {
    if (!data.backing.slateAuthConfigOid) {
      return {};
    }

    let tenant = await getTenantForSlates(data.tenant);
    let slateAuthConfig = await db.slateAuthConfig.findUnique({
      where: { oid: data.backing.slateAuthConfigOid }
    });
    if (!slateAuthConfig) {
      return {};
    }

    await slates.slateAuthConfig.delete({
      tenantId: tenant.id,
      slateAuthConfigId: slateAuthConfig.id
    });

    return {};
  }

  override async retrieveProviderOAuthSetup(
    data: ProviderOAuthSetupRetrieveParam
  ): Promise<ProviderOAuthSetupRetrieveRes> {
    if (!data.setup.slateOAuthSetupOid) {
      throw new Error('Setup does not have associated slate OAuth setup');
    }

    let setup = await db.slateOAuthSetup.findUniqueOrThrow({
      where: { oid: data.setup.slateOAuthSetupOid }
    });

    let record = await slates.slateOAuthSetup.getLogsSync({
      slateOAuthSetupId: setup.id
    });

    let slateAuthConfig = record.authConfig
      ? await db.slateAuthConfig.upsert({
          where: { id: record.authConfig.id },
          create: {
            oid: snowflake.nextId(),
            id: record.authConfig.id,
            slateOid: setup.slateOid,
            tenantOid: data.tenant.oid,
            projectOid: data.tenant.projectOid
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

  override async getProviderAuthCredentialsScopes(
    data: GetProviderAuthCredentialsScopesParam
  ): Promise<GetProviderAuthCredentialsScopesRes> {
    if (!data.providerAuthCredentials.slateCredentialsOid) {
      return { scopes: [] };
    }

    let tenant = await getTenantForSlates(data.tenant);
    let slateOAuthCredentials = await db.slateOAuthCredentials.findUnique({
      where: { oid: data.providerAuthCredentials.slateCredentialsOid }
    });
    if (!slateOAuthCredentials) {
      return { scopes: [] };
    }

    let record = await slates.slateOAuthCredentials.get({
      tenantId: tenant.id,
      slateOAuthCredentialsId: slateOAuthCredentials.id
    });

    return {
      scopes: record.scopes ?? []
    };
  }

  override async getProviderAuthConfigScopes(
    data: GetProviderAuthConfigScopesParam
  ): Promise<GetProviderAuthConfigScopesRes> {
    if (!data.authConfigVersion.slateAuthConfigOid) {
      return { scopes: [] };
    }

    let tenant = await getTenantForSlates(data.tenant);
    let slateAuthConfig = await db.slateAuthConfig.findUnique({
      where: { oid: data.authConfigVersion.slateAuthConfigOid }
    });
    if (!slateAuthConfig) {
      return { scopes: [] };
    }

    let record = await slates.slateAuthConfig.get({
      tenantId: tenant.id,
      slateAuthConfigId: slateAuthConfig.id
    });

    return { scopes: resolveSlateAuthConfigScopes(record) };
  }
}
