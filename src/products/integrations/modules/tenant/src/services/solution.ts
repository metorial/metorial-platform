import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, get4ByteIntId, ID } from '@metorial-subspace/db';

let include = {};

let getSolutionByIdUncached = async (d: { id: string }) =>
  db.solution.findFirst({
    where: { OR: [{ id: d.id }, { identifier: d.id }] },
    include
  });

let getSolutionByIdCached = createLocallyCachedFunction({
  getHash: (d: { id: string }) => d.id,
  ttlSeconds: 60 * 10,
  provider: getSolutionByIdUncached
});

class solutionServiceImpl {
  async upsertSolution(d: {
    input: {
      name: string;
      identifier: string;
    };
  }) {
    return await db.solution.upsert({
      where: { identifier: d.input.identifier },
      update: { name: d.input.name },
      create: {
        id: await ID.generateId('solution'),
        oid: get4ByteIntId(),
        name: d.input.name,
        identifier: d.input.identifier
      },
      include
    });
  }

  async getSolutionById(d: { id: string }) {
    let solution = await getSolutionByIdCached(d);
    if (!solution) solution = await getSolutionByIdUncached(d);
    if (!solution) throw new ServiceError(notFoundError('solution'));
    return solution;
  }
}

export let solutionService = Service.create(
  'solutionService',
  () => new solutionServiceImpl()
).build();
