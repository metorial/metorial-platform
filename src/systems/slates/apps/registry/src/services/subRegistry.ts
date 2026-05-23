import { badRequestError, conflictError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type {
  SubRegistry,
  SubRegistryFilterType,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';

let include = {
  tenant: true,
  filters: true
};

let validFilterTypes = ['scope', 'prefix', 'package'] as const;

let validateFilterType = (type: string) => {
  if (!validFilterTypes.includes(type as SubRegistryFilterType)) {
    throw new ServiceError(
      badRequestError({
        message: `Invalid filter type "${type}". Must be one of: ${validFilterTypes.join(', ')}`
      })
    );
  }
};

let validateFilterValue = (type: SubRegistryFilterType, value: string): void => {
  if (value.length === 0) {
    throw new ServiceError(
      badRequestError({
        message: `${type} filter value cannot be empty`
      })
    );
  }
};

let baseDomain = env.url.SUB_REGISTRY_BASE_DOMAIN;
if (baseDomain && !baseDomain.startsWith('.')) {
  baseDomain = `.${baseDomain}`;
}

class subRegistryServiceImpl {
  async createSubRegistry(d: {
    input: {
      name: string;
      identifier: string;
    };
    tenant: Tenant;
  }) {
    return db.$transaction(async db => {
      let existingSubRegistry = await db.subRegistry.findFirst({
        where: {
          identifier: d.input.identifier
        }
      });
      if (existingSubRegistry) {
        throw new ServiceError(
          conflictError({
            message: `SubRegistry with identifier ${d.input.identifier} already exists`
          })
        );
      }

      return await db.subRegistry.create({
        data: {
          ...getId('subRegistry'),

          identifier: d.input.identifier,
          name: d.input.name,

          tenantOid: d.tenant.oid
        },
        include
      });
    });
  }

  async getSubRegistryById(d: { id: string; tenant?: Tenant }) {
    let reg = await db.subRegistry.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }],
        tenantOid: d.tenant?.oid
      },
      include
    });
    if (!reg) throw new ServiceError(notFoundError('tenant.sub_registry'));
    return reg;
  }

  async getSubRegistryFromUrl(d: { url: string; subRegistryId?: string }) {
    let identifier = d.subRegistryId;

    if (!identifier) {
      if (!baseDomain) return null;

      let url = new URL(d.url);
      let remainingHost = url.hostname.replace(baseDomain, '');
      if (!remainingHost || remainingHost === url.hostname) {
        return null;
      }

      identifier = remainingHost;
    }

    let reg = await db.subRegistry.findFirst({
      where: { identifier },
      include
    });
    if (!reg) throw new ServiceError(notFoundError('tenant.sub_registry'));
    return reg;
  }

  async listSubRegistries(d: { tenant?: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.subRegistry.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant?.oid
            },
            include
          })
      )
    );
  }

  async addFilter(d: {
    subRegistry: SubRegistry;
    input: {
      type: SubRegistryFilterType;
      value: string;
    };
  }) {
    validateFilterType(d.input.type);
    validateFilterValue(d.input.type, d.input.value);

    return db.subRegistryFilter.create({
      data: {
        ...getId('subRegistryFilter'),
        type: d.input.type,
        value: d.input.value,
        subRegistryOid: d.subRegistry.oid
      }
    });
  }

  async removeFilter(d: { subRegistry: SubRegistry; filterId: string }) {
    let filter = await db.subRegistryFilter.findFirst({
      where: {
        id: d.filterId,
        subRegistryOid: d.subRegistry.oid
      }
    });

    if (!filter) throw new ServiceError(notFoundError('sub_registry.filter'));

    await db.subRegistryFilter.delete({
      where: { oid: filter.oid }
    });
  }

  async listFilters(d: { subRegistry: SubRegistry }) {
    return db.subRegistryFilter.findMany({
      where: { subRegistryOid: d.subRegistry.oid },
      orderBy: { createdAt: 'asc' }
    });
  }

  async setFilters(d: {
    subRegistry: SubRegistry;
    filters: Array<{ type: SubRegistryFilterType; value: string }>;
  }) {
    for (let filter of d.filters) {
      validateFilterType(filter.type);
      validateFilterValue(filter.type, filter.value);
    }

    return db.$transaction(async db => {
      await db.subRegistryFilter.deleteMany({
        where: { subRegistryOid: d.subRegistry.oid }
      });

      if (d.filters.length > 0) {
        await db.subRegistryFilter.createMany({
          data: d.filters.map(f => ({
            ...getId('subRegistryFilter'),
            type: f.type as SubRegistryFilterType,
            value: f.value,
            subRegistryOid: d.subRegistry.oid
          }))
        });
      }

      return db.subRegistry.findFirstOrThrow({
        where: { oid: d.subRegistry.oid },
        include
      });
    });
  }

  async clearFilters(d: { subRegistry: SubRegistry }) {
    await db.subRegistryFilter.deleteMany({
      where: { subRegistryOid: d.subRegistry.oid }
    });
  }
}

export let subRegistryService = Service.create(
  'subRegistryService',
  () => new subRegistryServiceImpl()
).build();
