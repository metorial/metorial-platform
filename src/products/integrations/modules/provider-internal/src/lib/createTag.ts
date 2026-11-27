import { createShortIdGenerator } from '@lowerdeck/slugify';
import { db, getId, withTransaction } from '@metorial-subspace/db';

let gen = createShortIdGenerator(
  async tag => !(await db.providerTag.findFirst({ where: { tag } })),
  { length: 6 }
);

export let createTag = () =>
  withTransaction(
    async db => {
      let tag = await gen();

      let newTag = await db.providerTag.create({
        data: {
          ...getId('providerTag'),
          tag
        }
      });

      return newTag.tag;
    },
    { ifExists: true }
  );
