import { conflictError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Tenant, User } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

let include = {
  scope: true,
  tenant: true
};

class userServiceImpl {
  async createUser(d: {
    input: {
      name: string;
      identifier: string;
    };
    tenant: Tenant;
  }) {
    return db.$transaction(async db => {
      let existingScope = await db.scope.findFirst({
        where: {
          identifier: d.input.identifier
        }
      });
      if (existingScope) {
        throw new ServiceError(
          conflictError({
            message: `User with identifier ${d.input.identifier} already exists`
          })
        );
      }

      let scope = await db.scope.create({
        data: {
          ...getId('scope'),
          type: 'user' as const,
          status: 'active',

          identifier: d.input.identifier,
          name: d.input.name,

          tenantOid: d.tenant.oid,

          links: []
        }
      });

      return await db.user.create({
        data: {
          ...getId('user'),
          status: 'active',
          access: 'read_write',

          identifier: d.input.identifier,
          name: d.input.name,

          tenantOid: d.tenant.oid,
          scopeOid: scope.oid
        },
        include
      });
    });
  }

  async ensureUserByIdentifier(d: { identifier: string; name: string; tenant: Tenant }) {
    let user = await db.user.findFirst({
      where: {
        identifier: d.identifier,
        tenantOid: d.tenant.oid,
        status: 'active'
      },
      include
    });
    if (user) return user;

    return this.createUser({
      input: {
        identifier: d.identifier,
        name: d.name
      },
      tenant: d.tenant
    });
  }

  async getUserById(d: { id: string; tenant?: Tenant }) {
    let user = await db.user.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }],
        tenantOid: d.tenant?.oid,
        status: 'active'
      },
      include
    });
    if (!user) throw new ServiceError(notFoundError('user'));
    return user;
  }

  async listUsers(d: { tenant?: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.user.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant?.oid,
              status: 'active'
            },
            include
          })
      )
    );
  }

  async updateUser(d: {
    user: User;
    input: {
      name?: string;
      description?: string;
      links?: { url: string; label: string }[];
    };
  }) {
    return await db.$transaction(async db => {
      await db.scope.update({
        where: { oid: d.user.scopeOid },
        data: {
          name: d.input.name,
          description: d.input.description,
          links: d.input.links
        }
      });

      return await db.user.update({
        where: { oid: d.user.oid },
        data: { name: d.input.name },
        include
      });
    });
  }
}

export let userService = Service.create('userService', () => new userServiceImpl()).build();
