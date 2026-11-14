import { createObjectDeleteQueue } from '@lowerdeck/queue';
import { getConfig } from '@metorial/config';
import { getStorage } from '../storage';

export let auditingObjectDelete = createObjectDeleteQueue({
  name: 'auditing/storage/object/delete',
  redisUrl: getConfig().redisUrl,
  deleteObject: (bucket, key) => getStorage().deleteObject(bucket, key)
});
