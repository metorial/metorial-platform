import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { ID, snowflake } from '../id';

let include = {};

class actorServiceImpl {
  async upsertActor(d: {
    input: {
      name: string;
      identifier: string;
    };
  }) {
    return await db.actor.upsert({
      where: { identifier: d.input.identifier },
      update: { name: d.input.name },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('actor'),
        name: d.input.name,
        identifier: d.input.identifier
      },
      include
    });
  }

  async getActorById(d: { id: string }) {
    let actor = await db.actor.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] },
      include
    });
    if (!actor) throw new ServiceError(notFoundError('actor'));
    return actor;
  }
}

export let actorService = Service.create('actorService', () => new actorServiceImpl()).build();
