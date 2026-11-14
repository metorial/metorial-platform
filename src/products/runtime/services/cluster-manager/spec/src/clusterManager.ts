import { error, method, service, t } from '@lowerdeck/rpc-spec';
import { functionUnavailable, invocationUnauthorized, InvokeInput, InvokeOutput } from './invoke';

export let ObjectRef = t
  .object({
    bucket: t.string({ minLength: 1 }),
    key: t.string({ minLength: 1 })
  })
  .named('ObjectRef');

export let BundleRef = t
  .object({
    bucket: t.string({ minLength: 1 }),
    key: t.string({ minLength: 1 }),
    sha256: t.string({ pattern: '^[0-9a-f]{64}$' }),
    sizeBytes: t.int({ min: 0 })
  })
  .named('BundleRef');

export let Sandbox = t.enum(['runc', 'gvisor']).named('Sandbox');

export let FunctionState = t.enum(['materialized', 'warm']).named('FunctionState');

export let MaterializedFunction = t
  .object({
    versionId: t.string(),
    name: t.string(),
    state: FunctionState,
    readyPods: t.int({ min: 0 }),
    reason: t.enum(['on-demand', 'speculative']),
    lastInvokedAt: t.datetime().nullable(),
    createdAt: t.datetime()
  })
  .named('MaterializedFunction');

export let BuildStatus = t.enum(['pending', 'running', 'succeeded', 'failed']).named('BuildStatus');

export let Build = t
  .object({
    runId: t.string(),
    name: t.string(),
    status: BuildStatus,
    exitCode: t.int().nullable(),
    failureReason: t.string().nullable(),
    uploadedSteps: t.array(t.string()),
    startedAt: t.datetime().nullable(),
    finishedAt: t.datetime().nullable()
  })
  .named('Build');

export let BuildLogLine = t
  .object({
    ts: t.datetime(),
    line: t.string()
  })
  .named('BuildLogLine');

let bundleInvalid = error({
  status: 422,
  code: 'bundle_invalid',
  message: 'The bundle archive is invalid.',
  data: { reason: t.string() }
});

let objectNotAllowed = error({
  status: 403,
  code: 'object_not_allowed',
  message: 'The caller may not use this bucket.',
  data: { bucket: t.string() }
});

let functionNotMaterialized = error({
  status: 404,
  code: 'function_not_materialized',
  message: 'The function version is not materialized.'
});

let functionNotReady = error({
  status: 503,
  code: 'function_not_ready',
  message: 'The function version did not become ready in time.',
  data: { reason: t.string().optional() }
});

let clusterCapacity = error({
  status: 503,
  code: 'cluster_capacity',
  message: 'The materialization cap is reached and nothing can be evicted.'
});

let buildNotFound = error({
  status: 404,
  code: 'build_not_found',
  message: 'No build exists for this run.'
});

export default service({
  name: 'cluster-manager',
  description: 'Owns every Kubernetes interaction of the runtime system: functions on Knative and builds as Jobs.',
  go: { package: 'clustermanagerrpc' },
  ts: { client: 'ClusterManagerClient' },

  methods: {
    bundle: {
      import: method({
        input: t.object({
          versionId: t.string({ minLength: 1 }),
          source: ObjectRef.description('A zip archive produced by a build.')
        }),
        output: BundleRef,
        errors: [bundleInvalid, objectNotAllowed]
      }).description('Idempotent by version ID: repacks the zip as tar.zst into the bundle bucket.')
    },

    function: {
      ensure: method({
        input: t.object({
          versionId: t.string({ minLength: 1 }),
          functionId: t.string({ minLength: 1 }),
          tenantId: t.string(),
          mode: t.enum(['on-demand', 'speculative']),
          runtime: t.object({ identifier: t.literal('nodejs'), version: t.string() }),
          entrypoint: t.object({
            path: t.string({ minLength: 1 }),
            export: t.string(),
            kind: t.enum(['module', 'enveloped'])
          }),
          bundle: BundleRef,
          env: t.record(t.string()),
          memoryMb: t.int({ min: 128, max: 10240 }),
          timeoutSeconds: t.int({ min: 1, max: 900 }),
          concurrency: t.enum(['exclusive', 'shared']),
          sandbox: Sandbox.optional()
        }),
        output: t.object({
          state: t.enum(['materialized', 'declined']),
          name: t.string().optional()
        }),
        errors: [functionNotReady, clusterCapacity, objectNotAllowed]
      }).description('Idempotent by name. `on-demand` waits until Ready; `speculative` may decline.'),

      delete: method({
        input: t.object({ versionId: t.string({ minLength: 1 }) }),
        output: t.void()
      }),

      list: method({
        input: t.object({ functionId: t.string({ minLength: 1 }) }),
        output: t.object({ items: t.array(MaterializedFunction) })
      }),

      invoke: method({
        input: InvokeInput,
        output: InvokeOutput,
        errors: [functionNotMaterialized, functionUnavailable, invocationUnauthorized]
      })
        .idempotent(false)
        .description('Forwards one invocation to the version\'s supervisor. Never retried.')
    },

    build: {
      start: method({
        input: t.object({
          runId: t.string({ minLength: 1 }),
          image: t.enum(['build-ubuntu']),
          script: t.string({ minLength: 1 }),
          env: t.record(t.string()),
          downloads: t.array(
            t.object({ artifactId: t.string({ minLength: 1 }), bucket: t.string(), key: t.string() })
          ),
          uploads: t.array(t.object({ stepId: t.string({ minLength: 1 }), bucket: t.string(), key: t.string() })),
          timeoutSeconds: t.int({ min: 60, max: 7200 }),
          sandbox: Sandbox.optional(),
          egressGrant: t.string({ minLength: 1 })
        }),
        output: Build,
        errors: [objectNotAllowed]
      }).description('Idempotent by run ID.'),

      get: method({
        input: t.object({ runId: t.string({ minLength: 1 }) }),
        output: Build,
        errors: [buildNotFound]
      }),

      logs: method({
        input: t.object({
          runId: t.string({ minLength: 1 }),
          cursor: t.string().optional(),
          limit: t.int({ min: 1, max: 5000 }).optional()
        }),
        output: t.object({ lines: t.array(BuildLogLine), nextCursor: t.string() }),
        errors: [buildNotFound]
      }),

      delete: method({
        input: t.object({ runId: t.string({ minLength: 1 }) }),
        output: t.void()
      })
    }
  }
});
