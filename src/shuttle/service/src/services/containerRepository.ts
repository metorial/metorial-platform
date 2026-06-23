import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { type ParsedImageRef } from '../lib/docker/parseImageRef';
import { containerRegistryService } from './containerRegistry';

let include = {
  tenant: true,
  registry: true
};

class containerRepositoryServiceImpl {
  async ensureRepository(d: {
    scope: { type: 'global' } | { type: 'tenant'; tenant: Tenant };
    input: {
      ref: ParsedImageRef;

      username?: string;
      password?: string;
    };
  }) {
    let registry = await containerRegistryService.ensureRegistry({
      scope: d.scope,
      input: {
        url: d.input.ref.registry,
        username: d.input.username,
        password: d.input.password
      }
    });

    let identifier = `repo::`;
    if (registry.tenant) identifier += `${registry.tenantOid}::`;
    identifier += `${registry.id}::${d.input.ref.repository}`;

    return await db.containerRepository.upsert({
      where: { identifier },
      update: {},
      create: {
        ...getId('repository'),
        type: 'docker',
        identifier,
        name: d.input.ref.repository,
        registryOid: registry.oid,
        tenantOid: registry.tenant?.oid
      },
      include: {
        tenant: true,
        registry: true
      }
    });
  }

  async getRepositoryById(d: { tenant: Tenant; repositoryId: string }) {
    let repository = await db.containerRepository.findFirst({
      where: {
        AND: [
          { OR: [{ id: d.repositoryId }, { identifier: d.repositoryId }] },
          { OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }] }
        ]
      },
      include
    });
    if (!repository) throw new ServiceError(notFoundError('repository'));
    return repository;
  }

  async listRepositories(d: { tenant: Tenant; registryIds?: string[] }) {
    let registries = d.registryIds
      ? await db.containerRegistry.findMany({
          where: {
            AND: [
              { id: { in: d.registryIds } },
              { OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }] }
            ]
          },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.containerRepository.findMany({
            ...opts,
            where: {
              registryOid: registries ? { in: registries.map(r => r.oid) } : undefined,
              OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
            },
            include
          })
      )
    );
  }
}

export let containerRepositoryService = Service.create(
  'containerRepositoryService',
  () => new containerRepositoryServiceImpl()
).build();
