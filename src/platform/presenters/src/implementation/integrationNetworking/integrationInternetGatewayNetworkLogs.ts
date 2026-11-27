import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { integrationInternetGatewayNetworkLogsType } from '../../types';

let networkLogRecordSchema = v.object(
  {
    object: v.literal('integration.internet_gateway.network_log', {
      description: 'String representing the object’s type.'
    }),
    direction: v.enumOf(['ingress', 'egress'], {
      description: 'Whether the record is an ingress or egress log.'
    }),
    enclave_id: v.string({
      description: 'Enclave the record belongs to.'
    }),
    bucket_start: v.string({
      description: 'Start of the time bucket, as an ISO timestamp.'
    }),
    hostname: v.string({
      description: 'Hostname observed in the record.'
    }),
    ip: v.string({
      description: 'IP address observed in the record.'
    }),
    port: v.number({
      description: 'Port observed in the record.'
    }),
    count: v.number({
      description: 'Requests folded into this record.'
    }),
    result: v.optional(
      v.enumOf(['allowed', 'denied'], {
        description: 'Whether the traffic was allowed or denied. Only set for ingress logs.'
      })
    ),
    first_seen_at: v.string({
      description: 'When matching traffic was first seen, as an ISO timestamp.'
    }),
    last_seen_at: v.string({
      description: 'When matching traffic was last seen, as an ISO timestamp.'
    })
  },
  {
    description: 'One bucket of network logs.'
  }
);

export let v1IntegrationInternetGatewayNetworkLogsPresenter = Presenter.create(
  integrationInternetGatewayNetworkLogsType
)
  .presenter(async ({ logs }) => ({
    object: 'integration.internet_gateway.network_logs' as const,
    direction: logs.direction,
    enclave_ids: logs.enclaveIds,
    records: logs.records.map(record => ({
      object: 'integration.internet_gateway.network_log' as const,
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
      object: v.literal('integration.internet_gateway.network_logs', {
        description: 'String representing the object’s type.'
      }),
      direction: v.enumOf(['ingress', 'egress'], {
        description: 'Whether these are ingress or egress logs.'
      }),
      enclave_ids: v.array(
        v.string({
          description: 'Enclave covered by these logs.'
        }),
        {
          description: 'Enclaves covered by these logs.'
        }
      ),
      records: v.array(networkLogRecordSchema, {
        description: 'Log records in the response.'
      })
    })
  )
  .build();
