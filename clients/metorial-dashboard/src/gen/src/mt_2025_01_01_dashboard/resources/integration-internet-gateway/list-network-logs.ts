import { mapObject } from '@metorial/util-resource-mapper/compact';

export type IntegrationInternetGatewayListNetworkLogsOutput = {
  object: 'integration.internet_gateway.network_logs';
  direction: 'ingress' | 'egress';
  enclaveIds: string[];
  records: {
    object: 'integration.internet_gateway.network_log';
    direction: 'ingress' | 'egress';
    enclaveId: string;
    bucketStart: string;
    hostname: string;
    ip: string;
    port: number;
    count: number;
    result?: 'allowed' | 'denied' | undefined;
    firstSeenAt: string;
    lastSeenAt: string;
  }[];
};

export let mapIntegrationInternetGatewayListNetworkLogsOutput =
  /* @__PURE__ */ mapObject<IntegrationInternetGatewayListNetworkLogsOutput>([
    'enclave_ids',
    [
      'records',
      0,
      [
        2,
        [
          1,
          [
            'enclave_id',
            'bucket_start',
            ['first_seen_at', 1, 0],
            ['last_seen_at', 1, 0]
          ]
        ]
      ]
    ]
  ]);

export type IntegrationInternetGatewayListNetworkLogsQuery = {
  direction: 'ingress' | 'egress';
  enclaveId?: string | string[] | undefined;
  hostname?: string | string[] | undefined;
  ip?: string | string[] | undefined;
  from?: string | undefined;
  to?: string | undefined;
  intervalMinutes?: number | undefined;
};

export let mapIntegrationInternetGatewayListNetworkLogsQuery =
  /* @__PURE__ */ mapObject<IntegrationInternetGatewayListNetworkLogsQuery>([
    'enclave_id',
    'interval_minutes'
  ]);
