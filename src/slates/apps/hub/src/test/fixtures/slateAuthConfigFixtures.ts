import { defineFactory } from '@lowerdeck/testing-tools';
import type {
  PrismaClient,
  Secret,
  Slate,
  SlateAuthConfig,
  SlateAuthMethod,
  Tenant
} from '../../../prisma/generated/client';
import {
  Prisma,
  SecretType,
  SlateAuthConfigType,
  type SlateStatus
} from '../../../prisma/generated/client';
import { getId } from '../../id';

import { SecretFixtures } from './secretFixtures';
import { SlateAuthMethodFixtures } from './slateAuthMethodFixtures';
import { TenantFixtures } from './tenantFixtures';

export const SlateAuthConfigFixtures = (db: PrismaClient) => {
  const defaultConfig = async (data: {
    slateOid: bigint;
    tenantOid: bigint;
    authMethodOid: bigint;
    secretOid: bigint;
    type?: SlateAuthConfigType;
    overrides?: Omit<Partial<SlateAuthConfig>, 'oid' | 'id'>;
  }): Promise<SlateAuthConfig> => {
    const { oid, id } = getId('slateAuthConfig');

    const factory = defineFactory<SlateAuthConfig>(
      {
        oid,
        id,
        type: data.type ?? SlateAuthConfigType.manual,
        isProcessing: false,
        slateOid: data.slateOid,
        tenantOid: data.tenantOid,
        authMethodOid: data.authMethodOid,
        secretOid: data.secretOid,
        ...data.overrides
      } as SlateAuthConfig,
      {
        persist: value => {
          const { profile, routingMatchers, ...rest } = value;
          const data: Prisma.SlateAuthConfigUncheckedCreateInput = {
            ...rest,
            ...(profile === null ? { profile: Prisma.DbNull } : profile ? { profile } : {}),
            ...(routingMatchers === null
              ? { routingMatchers: Prisma.DbNull }
              : routingMatchers
                ? { routingMatchers }
                : {})
          };
          return db.slateAuthConfig.create({ data });
        }
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withSecret = async (data: {
    tenantOid: bigint;
    slateOid: bigint;
    authMethodOid: bigint;
  }): Promise<SlateAuthConfig> => {
    const secretFixtures = SecretFixtures(db);
    const secret = await secretFixtures.default({
      tenantOid: data.tenantOid,
      type: SecretType.slate_authentication_configuration
    });
    return defaultConfig({
      slateOid: data.slateOid,
      tenantOid: data.tenantOid,
      authMethodOid: data.authMethodOid,
      secretOid: secret.oid
    });
  };

  const complete = async (data?: {
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    type?: SlateAuthConfigType;
    configOverrides?: Omit<Partial<SlateAuthConfig>, 'oid' | 'id'>;
  }): Promise<{
    config: SlateAuthConfig;
    authMethod: SlateAuthMethod;
    slate: Slate;
    tenant: Tenant;
    secret: Secret;
  }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default();

    const authMethodFixtures = SlateAuthMethodFixtures(db);
    const { authMethod, slate } = await authMethodFixtures.withSlate({
      slateIdentifier: data?.slateIdentifier,
      slateStatus: data?.slateStatus
    });

    const secretFixtures = SecretFixtures(db);
    const secret = await secretFixtures.default({
      tenantOid: tenant.oid,
      type: SecretType.slate_authentication_configuration
    });

    const config = await defaultConfig({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      authMethodOid: authMethod.oid,
      secretOid: secret.oid,
      type: data?.type,
      overrides: data?.configOverrides
    });

    return { config, authMethod, slate, tenant, secret };
  };

  return {
    default: defaultConfig,
    withSecret,
    complete
  };
};
