import { db, getId } from '@metorial-subspace/db';

export let backend = await db.backend.upsert({
  where: { type: 'shuttle' },
  create: {
    ...getId('backend'),
    name: 'Slates',
    type: 'shuttle',
    identifier: 'shuttle'
  },
  update: {}
});
