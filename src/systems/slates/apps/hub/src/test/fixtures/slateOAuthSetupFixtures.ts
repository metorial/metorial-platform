import type {
  PrismaClient,
  SlateInstanceOAuthSetup,
  SlateOAuthCredentials,
  SlateAuthMethod,
  Slate,
  SlateVersion,
  Tenant,
  Secret
} from '../../../prisma/generated/client';
import {
  SlateInstanceOAuthSetupStatus,
  SecretType,
  SlateStatus
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { SlateFixtures } from './slateFixtures';
import { TenantFixtures } from './tenantFixtures';
import { SecretFixtures } from './secretFixtures';
import { SlateAuthMethodFixtures } from './slateAuthMethodFixtures';
import { SlateOAuthCredentialsFixtures } from './slateOAuthCredentialsFixtures';

export const SlateOAuthSetupFixtures = (db: PrismaClient) => {
  const defaultSetup = async (data: {
    slateOid: bigint;
    tenantOid: bigint;
    slateVersionOid: bigint;
    authMethodOid: bigint;
    oauthCredentialsOid: bigint;
    secretOid: bigint;
    status?: SlateInstanceOAuthSetupStatus;
    overrides?: Partial<SlateInstanceOAuthSetup>;
  }): Promise<SlateInstanceOAuthSetup> => {
    const { oid, id } = getId('slateInstanceOAuthSetup');

    const factory = defineFactory<SlateInstanceOAuthSetup>(
      {
        oid,
        id,
        status: data.status ?? SlateInstanceOAuthSetupStatus.unused,
        redirectUrl: 'https://example.com/callback',
        slateOid: data.slateOid,
        tenantOid: data.tenantOid,
        slateVersionOid: data.slateVersionOid,
        authMethodOid: data.authMethodOid,
        oauthCredentialsOid: data.oauthCredentialsOid,
        secretOid: data.secretOid,
        ...data.overrides
      } as SlateInstanceOAuthSetup,
      {
        persist: value => db.slateInstanceOAuthSetup.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withSecret = async (data: {
    tenantOid: bigint;
    slateOid: bigint;
    slateVersionOid: bigint;
    authMethodOid: bigint;
    oauthCredentialsOid: bigint;
  }): Promise<SlateInstanceOAuthSetup> => {
    const secretFixtures = SecretFixtures(db);
    const secret = await secretFixtures.default({
      tenantOid: data.tenantOid,
      type: SecretType.slate_oauth_setup
    });
    return defaultSetup({
      slateOid: data.slateOid,
      tenantOid: data.tenantOid,
      slateVersionOid: data.slateVersionOid,
      authMethodOid: data.authMethodOid,
      oauthCredentialsOid: data.oauthCredentialsOid,
      secretOid: secret.oid
    });
  };

  const complete = async (data?: {
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    status?: SlateInstanceOAuthSetupStatus;
    setupOverrides?: Partial<SlateInstanceOAuthSetup>;
  }): Promise<{
    setup: SlateInstanceOAuthSetup;
    credentials: SlateOAuthCredentials;
    authMethod: SlateAuthMethod;
    slate: Slate & { currentVersion: SlateVersion };
    tenant: Tenant;
    secret: Secret;
  }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default();

    const slateFixtures = SlateFixtures(db);
    const slate = await slateFixtures.complete({
      slateIdentifier: data?.slateIdentifier,
      slateStatus: data?.slateStatus ?? SlateStatus.active
    });

    const authMethodFixtures = SlateAuthMethodFixtures(db);
    const authMethod = await authMethodFixtures.default({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid
    });

    const secretFixtures = SecretFixtures(db);
    const credentialsSecret = await secretFixtures.default({
      tenantOid: tenant.oid,
      type: SecretType.slate_oauth_credentials
    });

    const credentialsFixtures = SlateOAuthCredentialsFixtures(db);
    const credentials = await credentialsFixtures.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      secretOid: credentialsSecret.oid
    });

    const setupSecret = await secretFixtures.default({
      tenantOid: tenant.oid,
      type: SecretType.slate_oauth_setup
    });

    const setup = await defaultSetup({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      slateVersionOid: slate.currentVersion.oid,
      authMethodOid: authMethod.oid,
      oauthCredentialsOid: credentials.oid,
      secretOid: setupSecret.oid,
      status: data?.status,
      overrides: data?.setupOverrides
    });

    return { setup, credentials, authMethod, slate, tenant, secret: setupSecret };
  };

  return {
    default: defaultSetup,
    withSecret,
    complete
  };
};
