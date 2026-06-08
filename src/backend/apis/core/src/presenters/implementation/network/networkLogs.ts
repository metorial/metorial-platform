import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { networkLogsType } from '../../types';

let networkLogRecordSchema = v.object({
  object: v.literal('network.log'),
  direction: v.enumOf(['ingress', 'egress']),
  enclave_id: v.string(),
  bucket_start: v.string(),
  hostname: v.string(),
  ip: v.string(),
  port: v.number(),
  count: v.number(),
  result: v.optional(v.enumOf(['allowed', 'denied'])),
  first_seen_at: v.string(),
  last_seen_at: v.string()
});

export let v1NetworkLogsPresenter = Presenter.create(networkLogsType)
  .presenter(async ({ logs }) => ({
    object: 'network.logs' as const,
    direction: logs.direction,
    enclave_ids: logs.enclaveIds,
    records: logs.records.map(record => ({
      object: 'network.log' as const,
      direction: record.direction,
      enclave_id: record.enclaveId,
      bucket_start: record.bucketStart,
      hostname: record.hostname,
      ip: record.ip,
      port: record.port,
      count: record.count,
      ...(record.result ? { result: record.result } : {}),
      first_seen_at: record.firstSeenAt,
      last_seen_at: record.lastSeenAt
    }))
  }))
  .schema(
    v.object({
      object: v.literal('network.logs'),
      direction: v.enumOf(['ingress', 'egress']),
      enclave_ids: v.array(v.string()),
      records: v.array(networkLogRecordSchema)
    })
  )
  .build();
