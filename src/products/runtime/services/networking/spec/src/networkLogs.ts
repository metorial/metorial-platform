import { method, service, t } from '@lowerdeck/rpc-spec';

export let Decision = t.enum(['allowed', 'denied']).named('Decision');

export let Source = t.enum(['lambda', 'knative', 'build']).named('Source');

export let Observation = t
  .object({
    bucketStart: t.datetime(),
    tenantId: t.string(),
    functionId: t.string(),
    effectiveFunctionId: t.string().optional(),
    enclaveId: t.string().optional(),
    buildRunId: t.string().optional(),
    hostname: t.string(),
    ip: t.string(),
    port: t.int({ min: 0, max: 65535 }),
    decision: Decision,
    source: Source,
    count: t.int({ min: 1 }),
    firstSeenAt: t.datetime(),
    lastSeenAt: t.datetime()
  })
  .named('Observation');

export default service({
  name: 'network-logs',
  description: 'Stores egress observations from the gateway and answers network-log queries.',
  go: { package: 'networklogsrpc' },
  ts: { client: 'NetworkLogsClient' },

  methods: {
    observation: {
      ingestMany: method({
        input: t.object({
          batchId: t.string({ minLength: 1 }),
          gatewayInstanceId: t.string({ minLength: 1 }),
          observations: t.array(Observation, { maxLength: 10_000 })
        }),
        output: t.object({ inserted: t.boolean() })
      }).description('Idempotent by batch ID.'),

      list: method({
        input: t.object({
          tenantId: t.string({ minLength: 1 }),
          enclaveIds: t.array(t.string()).optional(),
          functionIds: t.array(t.string()).optional(),
          hostnames: t.array(t.string()).optional(),
          ips: t.array(t.string()).optional(),
          decision: Decision.optional(),
          from: t.datetime().optional(),
          to: t.datetime().optional(),
          intervalMinutes: t.int({ min: 30 }).optional()
        }),
        output: t.object({ records: t.array(Observation) })
      })
    }
  }
});
