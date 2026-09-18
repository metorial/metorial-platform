import { createObjectDeleteQueue } from '@lowerdeck/queue';
import { getConfig } from '@metorial/config';
import { getStorage } from '../storage';

export let cargoObjectDelete = createObjectDeleteQueue({
  name: 'cargo/storage/object/delete',
  redisUrl: getConfig().redisUrl,
  deleteObject: (bucket, key) => getStorage().deleteObject(bucket, key)
});
