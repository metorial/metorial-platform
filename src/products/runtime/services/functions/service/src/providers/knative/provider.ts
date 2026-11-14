import { db } from '../../db';
import { ID, snowflake } from '../../id';

export let provider = await db.provider.upsert({
  where: {
    identifier: 'knative'
  },
  create: {
    oid: snowflake.nextId(),
    id: await ID.generateId('provider'),
    identifier: 'knative',
    name: 'Kubernetes (Knative)'
  },
  update: {
    name: 'Kubernetes (Knative)'
  }
});
