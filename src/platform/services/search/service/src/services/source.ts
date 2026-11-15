import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { ID, snowflake } from '../id';

let include = {};

let getSourceByIdCached = createLocallyCachedFunction({
  getHash: (d: { id: string }) => d.id,
  ttlSeconds: 60,
  provider: async (d: { id: string }) =>
    db.source.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] },
      include
    })
});

class sourceServiceImpl {
  async upsertSource(d: {
    input: {
      name: string;
      identifier: string;
    };
  }) {
    return await db.source.upsert({
      where: { identifier: d.input.identifier },
      update: { name: d.input.name },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('source'),
        name: d.input.name,
        identifier: d.input.identifier
      },
      include
    });
  }

  async getSourceById(d: { id: string }) {
    let source = await getSourceByIdCached(d);
    if (!source) throw new ServiceError(notFoundError('source'));
    return source;
  }
}

export let sourceService = Service.create(
  'sourceService',
  () => new sourceServiceImpl()
).build();
