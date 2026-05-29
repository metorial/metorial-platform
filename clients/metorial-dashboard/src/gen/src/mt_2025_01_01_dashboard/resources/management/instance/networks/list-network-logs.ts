import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceNetworksListNetworkLogsOutput = {
  object: 'network.logs';
  enclaveIds: string[];
  records: {
    object: 'network.log';
    enclaveId: string;
    bucketStart: string;
    hostname: string;
    ip: string;
    port: number;
    count: number;
    firstSeenAt: string;
    lastSeenAt: string;
  }[];
};

export let mapManagementInstanceNetworksListNetworkLogsOutput =
  mtMap.object<ManagementInstanceNetworksListNetworkLogsOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    enclaveIds: mtMap.objectField(
      'enclave_ids',
      mtMap.array(mtMap.passthrough())
    ),
    records: mtMap.objectField(
      'records',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          enclaveId: mtMap.objectField('enclave_id', mtMap.passthrough()),
          bucketStart: mtMap.objectField('bucket_start', mtMap.passthrough()),
          hostname: mtMap.objectField('hostname', mtMap.passthrough()),
          ip: mtMap.objectField('ip', mtMap.passthrough()),
          port: mtMap.objectField('port', mtMap.passthrough()),
          count: mtMap.objectField('count', mtMap.passthrough()),
          firstSeenAt: mtMap.objectField('first_seen_at', mtMap.passthrough()),
          lastSeenAt: mtMap.objectField('last_seen_at', mtMap.passthrough())
        })
      )
    )
  });

export type ManagementInstanceNetworksListNetworkLogsQuery = {
  enclaveId?: string | string[] | undefined;
  hostname?: string | string[] | undefined;
  ip?: string | string[] | undefined;
  from?: string | undefined;
  to?: string | undefined;
  intervalMinutes?: number | undefined;
};

export let mapManagementInstanceNetworksListNetworkLogsQuery =
  mtMap.object<ManagementInstanceNetworksListNetworkLogsQuery>({
    enclaveId: mtMap.objectField(
      'enclave_id',
      mtMap.union([
        mtMap.unionOption('string', mtMap.passthrough()),
        mtMap.unionOption(
          'array',
          mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
        )
      ])
    ),
    hostname: mtMap.objectField(
      'hostname',
      mtMap.union([
        mtMap.unionOption('string', mtMap.passthrough()),
        mtMap.unionOption(
          'array',
          mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
        )
      ])
    ),
    ip: mtMap.objectField(
      'ip',
      mtMap.union([
        mtMap.unionOption('string', mtMap.passthrough()),
        mtMap.unionOption(
          'array',
          mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
        )
      ])
    ),
    from: mtMap.objectField('from', mtMap.passthrough()),
    to: mtMap.objectField('to', mtMap.passthrough()),
    intervalMinutes: mtMap.objectField('interval_minutes', mtMap.passthrough())
  });

