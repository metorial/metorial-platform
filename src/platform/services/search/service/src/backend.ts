import { defaultBackend } from './backends';
import { AlgoliaBackend } from './backends/algolia';
import { db } from './db';
import { getId } from './id';

let isAlgolia = defaultBackend instanceof AlgoliaBackend;

if (isAlgolia) {
  await db.backend.upsert({
    where: { identifier: 'algolia' },
    create: {
      ...getId('backend'),
      isDefault: true,
      identifier: 'algolia',
      name: 'Algolia',
      id: 'algolia'
    },
    update: { isDefault: true }
  });

  await db.backend.updateMany({
    where: { identifier: { not: 'algolia' } },
    data: { isDefault: false }
  });
}

export let backend = await db.backend.upsert({
  where: { identifier: 'pg' },
  create: {
    ...getId('backend'),
    isDefault: !isAlgolia,
    identifier: 'pg',
    name: 'PostgreSQL',
    id: 'pg'
  },
  update: {
    isDefault: !isAlgolia
  }
});
