import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { assertAccess } from '../lib/docker/assertAccess';
import { parseDockerImageRef } from '../lib/docker/parseImageRef';
import { repositoryTagCreatedQueue } from '../queues/lifecycle/tag';
import { addAfterTransactionHook, withTransaction } from '../transaction';
import { containerRepositoryService } from './containerRepository';

let include = {
  tenant: true,
  currentVersion: true,
  repository: {
    include: {
      registry: true
    }
  }
};

class containerRepositoryTagServiceImpl {
  async ensureRepositoryTag(d: {
    scope: { type: 'global' } | { type: 'tenant'; tenant: Tenant };
    input: {
      imageRef: string;

      username?: string;
      password?: string;
    };

    serverDeploymentId?: string;
  }) {
    let ref = parseDockerImageRef(d.input.imageRef);
    await assertAccess({ ref, username: d.input.username, password: d.input.password });

    if (!ref.tag && !ref.digest) ref.tag = 'latest';

    let repository = await containerRepositoryService.ensureRepository({
      scope: d.scope,
      input: {
        ref,
        username: d.input.username,
        password: d.input.password
      }
    });

    let identifier = `repo::`;
    if (repository.tenant) identifier += `${repository.tenantOid}::`;
    identifier += `${repository.id}::${ref.canonicalName}`;

    return withTransaction(async db => {
      let newId = getId('repositoryTag');
      let tag = await db.containerRepositoryTag.upsert({
        where: {
          repositoryOid_identifier: {
            repositoryOid: repository.oid,
            identifier
          }
        },
        update: {},
        create: {
          ...newId,

          discoveryStatus: 'pending',

          identifier,
          name: ref.canonicalName,

          type: ref.digest ? 'digest' : 'tag',
          tag: ref.digest ? undefined : ref.tag,
          digest: ref.digest,

          repositoryOid: repository.oid,
          tenantOid: repository.tenant?.oid
        },
        include
      });

      if (tag.id === newId.id) {
        await addAfterTransactionHook(() =>
          repositoryTagCreatedQueue.add({
            tagId: tag.id,
            serverDeploymentId: d.serverDeploymentId
          })
        );
      }

      return tag;
    });
  }

  async getRepositoryTagById(d: { tenant: Tenant; repositoryTagId: string }) {
    let repositoryTag = await db.containerRepositoryTag.findFirst({
      where: {
        AND: [
          { OR: [{ id: d.repositoryTagId }, { identifier: d.repositoryTagId }] },
          { OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }] }
        ]
      },
      include
    });
    if (!repositoryTag) throw new ServiceError(notFoundError('repositoryTag'));
    return repositoryTag;
  }

  async listRepositoryTags(d: { tenant: Tenant; repositories?: string[] }) {
    let repositories = d.repositories
      ? await db.containerRepository.findMany({
          where: {
            AND: [
              { id: { in: d.repositories } },
              { OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }] }
            ]
          },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.containerRepositoryTag.findMany({
            ...opts,
            where: {
              repositoryOid: repositories ? { in: repositories.map(r => r.oid) } : undefined,
              OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
            },
            include
          })
      )
    );
  }
}

export let containerRepositoryTagService = Service.create(
  'containerRepositoryTagService',
  () => new containerRepositoryTagServiceImpl()
).build();
