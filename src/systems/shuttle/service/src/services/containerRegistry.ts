import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Hash } from '@mtsrc/hash';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { getRegistryName, normalizeRegistryUrl } from '../lib/docker/registries';
import { secretService } from './secret';

let include = {
  tenant: true
};

class containerRegistryServiceImpl {
  async ensureRegistry(d: {
    scope: { type: 'global' } | { type: 'tenant'; tenant: Tenant };
    input: {
      url: string;
      username?: string;
      password?: string;
    };
  }) {
    if ((d.input.password && !d.input.username) || (!d.input.password && d.input.username)) {
      throw new ServiceError(
        badRequestError({
          message: 'Both username and password must be provided together'
        })
      );
    }
    if (d.input.password && d.scope.type !== 'tenant') {
      throw new ServiceError(
        badRequestError({
          message: 'Authentication can only be set for tenant-specific registries'
        })
      );
    }

    let url = normalizeRegistryUrl(d.input.url);
    let tenant = d.scope.type === 'tenant' ? d.scope.tenant : undefined;

    let identifier = `reg::`;
    if (tenant) identifier += `${tenant.oid}::`;
    identifier += url;
    if (d.input.username) {
      identifier += `::${d.input.username}-${(await Hash.sha256(JSON.stringify([url, tenant?.oid, d.input.username, d.input.password]))).slice(0, 10)}`;
    }

    let secret =
      d.input.username && d.input.password && d.scope.type === 'tenant'
        ? await secretService.createSecret({
            tenant: d.scope.tenant,
            purpose: 'registry_credentials',
            secretData: {
              registryUrl: url,
              username: d.input.username,
              password: d.input.password
            }
          })
        : undefined;

    let name = getRegistryName(url);

    return await db.containerRegistry.upsert({
      where: { identifier },
      update: {},
      create: {
        ...getId('registry'),
        name,
        identifier,
        url,
        type: 'docker',
        tenantOid: tenant?.oid,
        secretOid: secret?.oid
      },
      include: {
        ...include,
        tenant: true
      }
    });
  }

  async getRegistryById(d: { tenant: Tenant; registryId: string }) {
    let registry = await db.containerRegistry.findFirst({
      where: {
        id: d.registryId,
        OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
      },
      include
    });
    if (!registry) throw new ServiceError(notFoundError('registry'));
    return registry;
  }

  async listRegistries(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.containerRegistry.findMany({
            ...opts,
            where: {
              OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
            },
            include
          })
      )
    );
  }
}

export let containerRegistryService = Service.create(
  'containerRegistryService',
  () => new containerRegistryServiceImpl()
).build();
