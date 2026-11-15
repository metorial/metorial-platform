import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Scope } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  user: true,
  workspace: true,
  tenant: true
};

class scopeServiceImpl {
  async getScopeById(d: { id: string }) {
    let scope = await db.scope.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }],
        status: 'active'
      },
      include
    });
    if (!scope) throw new ServiceError(notFoundError('scope'));
    return scope;
  }

  async listScopes(_d: {}) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scope.findMany({
            ...opts,
            where: {
              status: 'active'
            },
            include
          })
      )
    );
  }

  async updateScope(d: {
    scope: Scope;
    input: {
      name?: string;
    };
  }) {
    return await db.scope.update({
      where: { oid: d.scope.oid },
      data: {
        name: d.input.name ?? d.scope.name
      },
      include
    });
  }
}

export let scopeService = Service.create('scopeService', () => new scopeServiceImpl()).build();
