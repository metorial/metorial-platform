import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  ContainerRepository,
  ContainerRegistry,
  Tenant
} from '../../../prisma/generated/client';
import { ContainerRepositoryType } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { TenantFixtures } from './tenantFixtures';
import { ContainerRegistryFixtures } from './containerRegistryFixtures';

export const ContainerRepositoryFixtures = (db: PrismaClient) => {
  const defaultRepository = async (data: {
    registryOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ContainerRepository>;
  }): Promise<ContainerRepository> => {
    const { oid, id } = getId('repository');
    const identifier =
      data.overrides?.identifier ?? `test-repo-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<ContainerRepository>(
      {
        oid,
        id,
        type: ContainerRepositoryType.docker,
        identifier,
        name: data.overrides?.name ?? 'Test Repository',
        registryOid: data.registryOid,
        tenantOid: data.tenantOid,
        registryConnectionOid: null,
        createdAt: new Date(),
        ...data.overrides
      } as ContainerRepository,
      {
        persist: value => db.containerRepository.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withRegistry = async (data: {
    tenantOid: bigint;
    registryOverrides?: Partial<ContainerRegistry>;
    repositoryOverrides?: Partial<ContainerRepository>;
  }): Promise<ContainerRepository & { registry: ContainerRegistry }> => {
    const registryFixtures = ContainerRegistryFixtures(db);
    const registry = await registryFixtures.default({
      tenantOid: data.tenantOid,
      overrides: data.registryOverrides
    });

    const repository = await defaultRepository({
      registryOid: registry.oid,
      tenantOid: data.tenantOid,
      overrides: data.repositoryOverrides
    });

    return db.containerRepository.findUniqueOrThrow({
      where: { id: repository.id },
      include: { registry: true }
    }) as Promise<ContainerRepository & { registry: ContainerRegistry }>;
  };

  const withTenant = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    registryOverrides?: Partial<ContainerRegistry>;
    repositoryOverrides?: Partial<ContainerRepository>;
  }): Promise<ContainerRepository & { tenant: Tenant; registry: ContainerRegistry }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const registryFixtures = ContainerRegistryFixtures(db);
    const registry = await registryFixtures.default({
      tenantOid: tenant.oid,
      overrides: data?.registryOverrides
    });

    const repository = await defaultRepository({
      registryOid: registry.oid,
      tenantOid: tenant.oid,
      overrides: data?.repositoryOverrides
    });

    return db.containerRepository.findUniqueOrThrow({
      where: { id: repository.id },
      include: { tenant: true, registry: true }
    }) as Promise<ContainerRepository & { tenant: Tenant; registry: ContainerRegistry }>;
  };

  return {
    default: defaultRepository,
    withRegistry,
    withTenant
  };
};
