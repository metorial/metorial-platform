import { check, type CheckDefinition } from '@lowerdeck/doctor';
import { hostname } from 'node:os';
import { attempt } from '../resolutions';
import { idPart } from './ids';

export interface ObjectStorageLike {
  ping: () => Promise<void>;
  putObject: (
    bucket: string,
    key: string,
    data: string,
    contentType?: string
  ) => Promise<unknown>;
  getObject: (
    bucket: string,
    key: string
  ) => Promise<{ data: Uint8Array | ArrayBuffer | Buffer }>;
  deleteObject: (bucket: string, key: string) => Promise<void>;
}

export let objectStorageChecks = (options: {
  client: ObjectStorageLike;
  buckets: string[];
  instance?: string;
}): CheckDefinition[] => {
  let instance = options.instance ?? process.env.HOSTNAME ?? hostname();

  return [
    check({
      id: 'object-storage.reachable',
      title: 'Object storage is reachable',
      category: 'storage',
      severity: 'critical',
      target: 'object-storage',
      run: ctx =>
        attempt(ctx, 'object-storage', async () => {
          await options.client.ping();
          return ctx.pass('Object storage answered.');
        })
    }),

    ...options.buckets.map(bucket =>
      check({
        id: `object-storage.${idPart(bucket)}.round-trip`,
        title: `Bucket ${bucket} accepts writes`,
        category: 'storage',
        severity: 'critical',
        target: `object-storage/${bucket}`,
        dependsOn: ['object-storage.reachable'],
        minIntervalMs: 60_000,
        run: ctx =>
          attempt(
            ctx,
            'object-storage',
            async () => {
              let key = `.metorial-doctor/${idPart(instance)}`;
              let body = `doctor ${Date.now()}`;

              await options.client.putObject(bucket, key, body, 'text/plain');
              let read = await options.client.getObject(bucket, key);
              await options.client.deleteObject(bucket, key);

              if (new TextDecoder().decode(read.data as Uint8Array) != body) {
                return ctx.fail(
                  `Bucket ${bucket} returned different content than was written.`
                );
              }

              return ctx.pass(`Wrote, read and deleted an object in ${bucket}.`);
            },
            { bucket }
          )
      })
    )
  ];
};
