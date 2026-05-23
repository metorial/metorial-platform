import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { db } from '../db';

let include = {
  provider: true
};

class runtimeServiceImpl {
  async getRuntimeById(d: { id: string }) {
    let runtime = await db.runtime.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }]
      },
      include
    });
    if (!runtime) throw new ServiceError(notFoundError('runtime'));
    return runtime;
  }

  async listRuntimes() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.runtime.findMany({
            ...opts,
            include
          })
      )
    );
  }
}

export let runtimeService = Service.create(
  'runtimeService',
  () => new runtimeServiceImpl()
).build();
