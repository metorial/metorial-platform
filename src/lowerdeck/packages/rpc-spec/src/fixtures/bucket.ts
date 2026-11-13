import { error, method, service, t } from '../index';

export let BucketStatus = t.enum(['active', 'archived']).named('BucketStatus');

export let Bucket = t
  .object({
    id: t.string(),
    name: t.string({ minLength: 1, maxLength: 200 }).description('Human-readable name.'),
    status: BucketStatus,
    sizeBytes: t.int({ min: 0 }),
    labels: t.record(t.string()),
    createdAt: t.datetime(),
    archivedAt: t.datetime().nullable(),
    owner: t.string({ format: 'email' }).optional().nullable()
  })
  .description('A bucket of code files.')
  .named('Bucket');

export type FileEntryShape =
  | { type: 'file'; path: string; size: number }
  | { type: 'directory'; path: string; children: FileEntryShape[] };

export let FileEntry: t.Type<FileEntryShape> = t
  .union('type', {
    file: t.object({ path: t.string(), size: t.int() }),
    directory: t.object({
      path: t.string(),
      children: t.array(t.lazy((): t.Type<FileEntryShape> => FileEntry))
    })
  })
  .named('FileEntry');

let bucketArchived = error({
  status: 409,
  code: 'bucket_archived',
  message: 'The bucket is archived.',
  data: { bucketId: t.string() }
});

let page = <T extends t.Type<any>>(item: T) =>
  t.object({ items: t.array(item), nextCursor: t.string().optional() });

export default service({
  name: 'code-bucket',
  description: 'Stores and serves code bundles for function deployments.',
  go: { package: 'bucketrpc' },
  ts: { client: 'CodeBucketClient' },

  methods: {
    ping: method({
      input: t.void(),
      output: t.object({ ok: t.boolean() })
    }),

    bucket: {
      get: method({
        input: t.object({ bucketId: t.string({ minLength: 1 }) }),
        output: Bucket,
        errors: [bucketArchived]
      }),

      list: method({
        input: t.object({
          status: BucketStatus.optional(),
          cursor: t.string().optional(),
          limit: t.int({ min: 1, max: 500 }).optional()
        }),
        output: page(Bucket)
      }),

      archive: method({
        input: t.object({ bucketId: t.string() }),
        output: Bucket,
        errors: [bucketArchived]
      }).description('Idempotent: archiving an archived bucket returns it unchanged.'),

      delete: method({
        input: t.object({ bucketId: t.string() }),
        output: t.void()
      }),

      files: {
        tree: method({
          input: t.object({ bucketId: t.string(), prefix: t.string().optional() }),
          output: t.object({ root: FileEntry })
        }),

        put: method({
          input: t.object({
            bucketId: t.string(),
            path: t.string({ pattern: '^[^/].*$' }),
            content: t.bytes(),
            metadata: t.json().optional(),
            mode: t.literal('overwrite')
          }),
          output: t.object({ entry: FileEntry, version: t.number() })
        })
      }
    }
  }
});
