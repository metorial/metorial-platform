import { db } from '../../db';
import { ID, snowflake } from '../../id';

export let provider = await db.provider.upsert({
  where: {
    identifier: 'local'
  },
  create: {
    oid: snowflake.nextId(),
    id: await ID.generateId('provider'),
    identifier: 'local',
    name: 'Local Runtime'
  },
  update: {
    name: 'Local Runtime'
  }
});
