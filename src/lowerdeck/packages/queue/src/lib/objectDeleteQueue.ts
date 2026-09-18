import { createQueue } from './createQueue';

export let OBJECT_DELETE_CHUNK_SIZE = 500;

let chunk = <T>(items: T[], size: number) => {
  let chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export let createObjectDeleteQueue = (d: {
  name: string;
  redisUrl: string;
  deleteObject: (bucket: string, key: string) => Promise<unknown>;
  concurrency?: number;
  parallelism?: number;
}) => {
  let parallelism = d.parallelism ?? 25;

  let queue = createQueue<{ bucket: string; keys: string[] }>({
    name: d.name,
    redisUrl: d.redisUrl,
    workerOpts: { concurrency: d.concurrency ?? 100 }
  });

  let processor = queue.process(async data => {
    for (let keys of chunk(data.keys, parallelism)) {
      await Promise.all(
        keys.map(key =>
          d.deleteObject(data.bucket, key).catch(error => {
            console.error(`Failed to delete object ${data.bucket}/${key}`, error);
          })
        )
      );
    }
  });

  return {
    queue,
    processor,
    enqueue: async (bucket: string, keys: string[]) => {
      if (!keys.length) return;

      await queue.addMany(
        chunk(keys, OBJECT_DELETE_CHUNK_SIZE).map(batch => ({ bucket, keys: batch }))
      );
    }
  };
};
