import { db, getId } from '@metorial-subspace/db';

export let backend = await db.backend.upsert({
  where: { type: 'slates' },
  create: {
    ...getId('backend'),
    name: 'Slates',
    type: 'slates',
    identifier: 'slates'
  },
  update: {}
});
