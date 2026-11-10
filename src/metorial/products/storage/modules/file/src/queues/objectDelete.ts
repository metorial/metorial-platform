import { createObjectDeleteQueue } from '@lowerdeck/queue';
import { getConfig } from '@metorial/config';
import { deleteCargoObjectIfUnreferenced } from '../lib/cargoObjects';

export let cargoObjectDelete = createObjectDeleteQueue({
  name: 'cargo/storage/object/delete',
  redisUrl: getConfig().redisUrl,
  concurrency: 5,
  parallelism: 5,
  deleteObject: (bucket, key) => deleteCargoObjectIfUnreferenced({ bucket, key })
});
