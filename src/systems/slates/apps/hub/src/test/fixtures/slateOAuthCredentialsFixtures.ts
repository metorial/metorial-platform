import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  SlateOAuthCredentials,
  Slate,
  Tenant,
  Secret
} from '../../../prisma/generated/client';
import { SecretType, SlateStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { SlateFixtures } from './slateFixtures';
import { TenantFixtures } from './tenantFixtures';
import { SecretFixtures } from './secretFixtures';

export const SlateOAuthCredentialsFixtures = (db: PrismaClient) => {
  const defaultCredentials = async (data: {
    slateOid: bigint;
    tenantOid: bigint;
    secretOid: bigint;
    overrides?: Partial<SlateOAuthCredentials>;
  }): Promise<SlateOAuthCredentials> => {
    const { oid, id } = getId('slateOAuthCredentials');

    const factory = defineFactory<SlateOAuthCredentials>(
      {
        oid,
        id,
        slateOid: data.slateOid,
        tenantOid: data.tenantOid,
        secretOid: data.secretOid,
        clientId: `client_${randomBytes(8).toString('hex')}`,
        scopes: ['read', 'write'],
        ...data.overrides
      } as SlateOAuthCredentials,
      {
        persist: value => db.slateOAuthCredentials.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withSecret = async (data: {
    tenantOid: bigint;
    slateOid: bigint;
  }): Promise<SlateOAuthCredentials> => {
    const secretFixtures = SecretFixtures(db);
    const secret = await secretFixtures.default({
      tenantOid: data.tenantOid,
      type: SecretType.slate_oauth_credentials
    });
    return defaultCredentials({
      slateOid: data.slateOid,
      tenantOid: data.tenantOid,
      secretOid: secret.oid
    });
  };

  const complete = async (data?: {
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    credentialsOverrides?: Partial<SlateOAuthCredentials>;
  }): Promise<{
    credentials: SlateOAuthCredentials;
    slate: Slate;
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

    const secretFixtures = SecretFixtures(db);
    const secret = await secretFixtures.default({
      tenantOid: tenant.oid,
      type: SecretType.slate_oauth_credentials
    });

    const credentials = await defaultCredentials({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      secretOid: secret.oid,
      overrides: data?.credentialsOverrides
    });

    return { credentials, slate, tenant, secret };
  };

  return {
    default: defaultCredentials,
    withSecret,
    complete
  };
};
