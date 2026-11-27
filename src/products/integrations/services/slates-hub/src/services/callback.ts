import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Callback, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { callbackInstanceCleanupManyQueue } from '../queues/callback';
import { slateService } from './slate';

let include = { slate: true };

class callbackServiceImpl {
  async getCallbackById(d: { tenant: Tenant; id: string }) {
    let callback = await db.callback.findFirst({
      where: { tenantOid: d.tenant.oid, id: d.id, status: { not: 'deleted' } },
      include
    });
    if (!callback) throw new ServiceError(notFoundError('callback'));
    return callback;
  }

  async listCallbacks(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.callback.findMany({
            ...opts,
            where: { tenantOid: d.tenant.oid, status: { not: 'deleted' } },
            include
          })
      )
    );
  }

  async getManyCallbacksByIds(d: { tenant: Tenant; ids: string[] }) {
    return db.callback.findMany({
      where: { tenantOid: d.tenant.oid, id: { in: d.ids }, status: { not: 'deleted' } },
      include
    });
  }

  async createCallback(d: {
    tenant: Tenant;
    input: { slateId: string; name?: string; description?: string };
  }) {
    let slate = await slateService.getSlateById({ id: d.input.slateId });

    return db.callback.create({
      data: {
        ...getId('callback'),
        tenantOid: d.tenant.oid,
        slateOid: slate.oid,
        name: d.input.name,
        description: d.input.description
      },
      include
    });
  }

  async updateCallback(d: {
    tenant: Tenant;
    callback: Callback;
    input: { name?: string; description?: string };
  }) {
    if (d.callback.tenantOid !== d.tenant.oid) throw new ServiceError(notFoundError('callback'));

    return db.callback.update({
      where: { oid: d.callback.oid },
      data: { name: d.input.name, description: d.input.description },
      include
    });
  }

  async deleteCallback(d: { tenant: Tenant; callback: Callback }) {
    if (d.callback.tenantOid !== d.tenant.oid) throw new ServiceError(notFoundError('callback'));

    await db.callback.update({
      where: { oid: d.callback.oid },
      data: { status: 'deleted' }
    });

    await callbackInstanceCleanupManyQueue.add(
      { callbackId: d.callback.id },
      { id: d.callback.id }
    );
  }
}

export let callbackService = Service.create(
  'callbackService',
  () => new callbackServiceImpl()
).build();
