import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  ContainerRepositoryVersion,
  ContainerRepository
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { ContainerRepositoryFixtures } from './containerRepositoryFixtures';

export const ContainerRepositoryVersionFixtures = (db: PrismaClient) => {
  const defaultRepositoryVersion = async (data: {
    repositoryOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ContainerRepositoryVersion>;
  }): Promise<ContainerRepositoryVersion> => {
    const { oid, id } = getId('repositoryVersion');
    const digest =
      data.overrides?.digest ?? `sha256:${randomBytes(32).toString('hex')}`;

    const factory = defineFactory<ContainerRepositoryVersion>(
      {
        oid,
        id,
        digest,
        repositoryOid: data.repositoryOid,
        tenantOid: data.tenantOid,
        createdAt: new Date(),
        ...data.overrides
      } as ContainerRepositoryVersion,
      {
        persist: value => db.containerRepositoryVersion.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withRepository = async (data: {
    tenantOid: bigint;
    repositoryOverrides?: Partial<ContainerRepository>;
    versionOverrides?: Partial<ContainerRepositoryVersion>;
  }): Promise<ContainerRepositoryVersion & { repository: ContainerRepository }> => {
    const repositoryFixtures = ContainerRepositoryFixtures(db);
    const repository = await repositoryFixtures.withRegistry({
      tenantOid: data.tenantOid,
      repositoryOverrides: data.repositoryOverrides
    });

    const version = await defaultRepositoryVersion({
      repositoryOid: repository.oid,
      tenantOid: data.tenantOid,
      overrides: data.versionOverrides
    });

    return db.containerRepositoryVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: { repository: true }
    }) as Promise<ContainerRepositoryVersion & { repository: ContainerRepository }>;
  };

  return {
    default: defaultRepositoryVersion,
    withRepository
  };
};
