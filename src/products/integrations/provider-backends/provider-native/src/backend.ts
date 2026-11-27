import { db, getId } from '@metorial-subspace/db';

export let backend = await db.backend.upsert({
  where: { type: 'native' },
  create: {
    ...getId('backend'),
    name: 'Native Provider',
    type: 'native',
    identifier: 'native-provider'
  },
  update: {
    name: 'Native Provider',
    identifier: 'native-provider'
  }
});
