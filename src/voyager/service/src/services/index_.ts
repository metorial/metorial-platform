import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Source } from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';

let include = { source: true };

let getIndexByIdCached = createLocallyCachedFunction({
  getHash: (d: { id: string; sourceOid: bigint }) => d.id,
  ttlSeconds: 60,
  provider: async d =>
    db.index.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }], sourceOid: d.sourceOid },
      include
    })
});

class indexServiceImpl {
  async upsertIndex(d: {
    input: {
      name: string;
      identifier: string;
      source: Source;
    };
  }) {
    return await db.index.upsert({
      where: {
        sourceOid_identifier: {
          sourceOid: d.input.source.oid,
          identifier: d.input.identifier
        }
      },
      update: { name: d.input.name },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('index'),
        name: d.input.name,
        identifier: d.input.identifier,
        sourceOid: d.input.source.oid
      },
      include
    });
  }

  async getIndexById(d: { id: string; source: Source }) {
    let index = await getIndexByIdCached({
      id: d.id,
      sourceOid: d.source.oid
    });
    if (!index) throw new ServiceError(notFoundError('index'));
    return index;
  }
}

export let indexService = Service.create('indexService', () => new indexServiceImpl()).build();
