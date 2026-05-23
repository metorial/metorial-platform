import { randomBytes } from 'crypto';
import type { PrismaClient, Secret, Tenant } from '../../../prisma/generated/client';
import { SecretStatus, SecretType } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { TenantFixtures } from './tenantFixtures';

export const SecretFixtures = (db: PrismaClient) => {
  const defaultSecret = async (data: {
    tenantOid: bigint;
    type?: SecretType;
    overrides?: Partial<Secret>;
  }): Promise<Secret> => {
    const { oid, id } = getId('secret');

    const factory = defineFactory<Secret>(
      {
        oid,
        id,
        type: data.type ?? SecretType.server_config_value,
        status: SecretStatus.active,
        tenantOid: data.tenantOid,
        encryptedSecret: `encrypted_${randomBytes(16).toString('hex')}`,
        createdAt: new Date(),
        ...data.overrides
      } as Secret,
      {
        persist: value => db.secret.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const registryCredentials = async (data: {
    tenantOid: bigint;
    overrides?: Partial<Secret>;
  }): Promise<Secret> =>
    defaultSecret({
      tenantOid: data.tenantOid,
      type: SecretType.registry_credentials,
      overrides: data.overrides
    });

  const serverConfigValue = async (data: {
    tenantOid: bigint;
    overrides?: Partial<Secret>;
  }): Promise<Secret> =>
    defaultSecret({
      tenantOid: data.tenantOid,
      type: SecretType.server_config_value,
      overrides: data.overrides
    });

  const withTenant = async (data?: {
    type?: SecretType;
    tenantOverrides?: Partial<Tenant>;
    secretOverrides?: Partial<Secret>;
  }): Promise<Secret & { tenant: Tenant }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const secret = await defaultSecret({
      tenantOid: tenant.oid,
      type: data?.type,
      overrides: data?.secretOverrides
    });

    return db.secret.findUniqueOrThrow({
      where: { id: secret.id },
      include: { tenant: true }
    }) as Promise<Secret & { tenant: Tenant }>;
  };

  return {
    default: defaultSecret,
    registryCredentials,
    serverConfigValue,
    withTenant
  };
};
