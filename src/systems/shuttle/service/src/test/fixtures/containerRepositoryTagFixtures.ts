import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  ContainerRepositoryTag,
  ContainerRepository
} from '../../../prisma/generated/client';
import {
  ContainerRepositoryTagType,
  ContainerRepositoryTagDiscoveryStatus
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { ContainerRepositoryFixtures } from './containerRepositoryFixtures';

export const ContainerRepositoryTagFixtures = (db: PrismaClient) => {
  const defaultRepositoryTag = async (data: {
    repositoryOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ContainerRepositoryTag>;
  }): Promise<ContainerRepositoryTag> => {
    const { oid, id } = getId('repositoryTag');
    const tagName = `v1.0.${randomBytes(2).toString('hex')}`;
    const identifier =
      data.overrides?.identifier ?? `test-tag-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<ContainerRepositoryTag>(
      {
        oid,
        id,
        type: ContainerRepositoryTagType.tag,
        discoveryStatus: ContainerRepositoryTagDiscoveryStatus.pending,
        identifier,
        name: data.overrides?.name ?? `Tag ${tagName}`,
        tag: tagName,
        digest: null,
        currentVersionOid: null,
        repositoryOid: data.repositoryOid,
        tenantOid: data.tenantOid,
        lastDiscoveryErrorOid: null,
        createdAt: new Date(),
        lastSyncedAt: null,
        ...data.overrides
      } as ContainerRepositoryTag,
      {
        persist: value => db.containerRepositoryTag.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withStatus = async (
    status: ContainerRepositoryTagDiscoveryStatus,
    data: {
      repositoryOid: bigint;
      tenantOid: bigint;
      overrides?: Partial<ContainerRepositoryTag>;
    }
  ): Promise<ContainerRepositoryTag> =>
    defaultRepositoryTag({
      ...data,
      overrides: {
        ...data.overrides,
        discoveryStatus: status
      }
    });

  const digestTag = async (data: {
    repositoryOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ContainerRepositoryTag>;
  }): Promise<ContainerRepositoryTag> => {
    const digest = `sha256:${randomBytes(32).toString('hex')}`;
    return defaultRepositoryTag({
      ...data,
      overrides: {
        type: ContainerRepositoryTagType.digest,
        tag: null,
        digest,
        identifier: digest,
        name: `Digest ${digest.substring(0, 16)}...`,
        ...data.overrides
      }
    });
  };

  const withRepository = async (data: {
    tenantOid: bigint;
    repositoryOverrides?: Partial<ContainerRepository>;
    tagOverrides?: Partial<ContainerRepositoryTag>;
  }): Promise<ContainerRepositoryTag & { repository: ContainerRepository }> => {
    const repositoryFixtures = ContainerRepositoryFixtures(db);
    const repository = await repositoryFixtures.withRegistry({
      tenantOid: data.tenantOid,
      repositoryOverrides: data.repositoryOverrides
    });

    const tag = await defaultRepositoryTag({
      repositoryOid: repository.oid,
      tenantOid: data.tenantOid,
      overrides: data.tagOverrides
    });

    return db.containerRepositoryTag.findUniqueOrThrow({
      where: { id: tag.id },
      include: { repository: true }
    }) as Promise<ContainerRepositoryTag & { repository: ContainerRepository }>;
  };

  return {
    default: defaultRepositoryTag,
    withStatus,
    digestTag,
    withRepository
  };
};
