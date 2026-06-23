import { randomBytes } from 'crypto';
import type { PrismaClient, Secret, Tenant } from '../../../prisma/generated/client';
import { SecretStatus, SecretType } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
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
        type: data.type ?? SecretType.slate_authentication_configuration,
        status: SecretStatus.active,
        tenantOid: data.tenantOid,
        encryptedSecret: `encrypted_${randomBytes(16).toString('hex')}`,
        isDelegatedToNebula: false,
        nebulaSecretId: null,
        ...data.overrides
      } as Secret,
      {
        persist: value => db.secret.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

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
    withTenant
  };
};
