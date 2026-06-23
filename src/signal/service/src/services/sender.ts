import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { ID, snowflake } from '../id';

let include = {};

let getSenderByIdCached = createLocallyCachedFunction({
  getHash: (d: { id: string }) => d.id,
  ttlSeconds: 60,
  provider: async (d: { id: string }) =>
    db.sender.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] },
      include
    })
});

class senderServiceImpl {
  async upsertSender(d: {
    input: {
      name: string;
      identifier: string;
    };
  }) {
    return await db.sender.upsert({
      where: { identifier: d.input.identifier },
      update: { name: d.input.name },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('sender'),
        name: d.input.name,
        identifier: d.input.identifier
      },
      include
    });
  }

  async getSenderById(d: { id: string }) {
    let sender = await getSenderByIdCached(d);
    if (!sender) throw new ServiceError(notFoundError('sender'));
    return sender;
  }
}

export let senderService = Service.create(
  'senderService',
  () => new senderServiceImpl()
).build();
