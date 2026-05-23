import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  ContainerRegistry,
  Tenant,
  Secret
} from '../../../prisma/generated/client';
import { ContainerRegistryType } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { TenantFixtures } from './tenantFixtures';
import { SecretFixtures } from './secretFixtures';

export const ContainerRegistryFixtures = (db: PrismaClient) => {
  const defaultRegistry = async (data: {
    tenantOid: bigint;
    overrides?: Partial<ContainerRegistry>;
  }): Promise<ContainerRegistry> => {
    const { oid, id } = getId('registry');
    const identifier =
      data.overrides?.identifier ?? `test-registry-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<ContainerRegistry>(
      {
        oid,
        id,
        type: ContainerRegistryType.docker,
        identifier,
        name: data.overrides?.name ?? 'Test Registry',
        url: data.overrides?.url ?? 'https://registry.example.com',
        secretOid: data.overrides?.secretOid ?? null,
        tenantOid: data.tenantOid,
        createdAt: new Date(),
        ...data.overrides
      } as ContainerRegistry,
      {
        persist: value => db.containerRegistry.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withSecret = async (data: {
    tenantOid: bigint;
    registryOverrides?: Partial<ContainerRegistry>;
  }): Promise<ContainerRegistry & { secret: Secret }> => {
    const secretFixtures = SecretFixtures(db);
    const secret = await secretFixtures.registryCredentials({ tenantOid: data.tenantOid });

    const registry = await defaultRegistry({
      tenantOid: data.tenantOid,
      overrides: {
        secretOid: secret.oid,
        ...data.registryOverrides
      }
    });

    return db.containerRegistry.findUniqueOrThrow({
      where: { id: registry.id },
      include: { secret: true }
    }) as Promise<ContainerRegistry & { secret: Secret }>;
  };

  const withTenant = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    registryOverrides?: Partial<ContainerRegistry>;
  }): Promise<ContainerRegistry & { tenant: Tenant }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const registry = await defaultRegistry({
      tenantOid: tenant.oid,
      overrides: data?.registryOverrides
    });

    return db.containerRegistry.findUniqueOrThrow({
      where: { id: registry.id },
      include: { tenant: true }
    }) as Promise<ContainerRegistry & { tenant: Tenant }>;
  };

  return {
    default: defaultRegistry,
    withSecret,
    withTenant
  };
};
