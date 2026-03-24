import { randomBytes } from 'crypto';
import { defineFactory } from '@lowerdeck/testing-tools';
import { get4ByteIntId, getId, type PrismaClient, type Solution } from '@metorial-subspace/db';

export const SolutionFixtures = (db: PrismaClient) => {
  const defaultSolution = async (overrides: Partial<Solution> = {}): Promise<Solution> => {
    const { id } = getId('solution');
    const oid = get4ByteIntId();
    const identifier =
      overrides.identifier ?? `test-solution-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<Solution>(
      {
        oid,
        id,
        identifier,
        name: overrides.name ?? `Test Solution ${identifier}`
      } as Solution,
      {
        persist: value => db.solution.create({ data: value })
      }
    );

    return factory.create(overrides);
  };

  return {
    default: defaultSolution
  };
};
