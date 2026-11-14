import { db } from '../../db';
import { ID, snowflake } from '../../id';

export let provider = await db.provider.upsert({
  where: {
    identifier: 'aws.lambda'
  },
  create: {
    oid: snowflake.nextId(),
    id: await ID.generateId('provider'),
    identifier: 'aws.lambda',
    name: 'AWS Lambda'
  },
  update: {
    name: 'AWS Lambda'
  }
});
