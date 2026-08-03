import { Chart } from '@metorial/chart';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useFirewalls,
  useNetworkLogs,
  useNetworks
} from '@metorial/state';
import { Badge, Callout, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { EmptyText } from '../_common';

let getNetworkLogRange = () => {
  let to = new Date();
  let from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

  return { from, to };
};

let getHourlyBuckets = (from: Date, to: Date) => {
  let buckets: Date[] = [];
  let cursor = new Date(from);
  cursor.setMinutes(0, 0, 0);

  while (cursor <= to) {
    buckets.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
  }

  return buckets;
};

let getNetworkLogSeries = (
  records: {
    bucketStart: string;
    ip: string;
    count: number;
    result?: 'allowed' | 'denied';
  }[],
  from: Date,
  to: Date
) => {
  let buckets = getHourlyBuckets(from, to);
  let bucketKeys = new Set(buckets.map(bucket => bucket.toISOString()));
  let grouped = new Map<string, Map<string, number>>();

  for (let record of records) {
    let bucket = new Date(record.bucketStart);
    bucket.setMinutes(0, 0, 0);

    let bucketKey = bucket.toISOString();
    if (!bucketKeys.has(bucketKey)) continue;

    let result = record.result === 'denied' ? 'Denied' : 'Accepted';
    let ip = record.ip || 'Unknown IP';
    let groupKey = `${ip} (${result})`;
    let group = grouped.get(groupKey) ?? new Map<string, number>();
    group.set(bucketKey, (group.get(bucketKey) ?? 0) + record.count);
    grouped.set(groupKey, group);
  }

  return [...grouped.entries()]
    .map(([groupKey, values]) => ({
      id: groupKey,
      name: groupKey,
      total: [...values.values()].reduce((sum, count) => sum + count, 0),
      entries: buckets.map(bucket => ({
        key: bucket,
        value: values.get(bucket.toISOString()) ?? 0
      }))
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 7);
};

let getDeniedNetworkLogCount = (
  records: {
    count: number;
    result?: 'allowed' | 'denied';
  }[]
) =>
  records
    .filter(record => record.result === 'denied')
    .reduce((sum, record) => sum + record.count, 0);

export let NetworkOverviewPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let networks = useNetworks(instance.data?.id, { limit: 1 });
  let firewalls = useFirewalls(instance.data?.id, { limit: 10, order: 'desc' });
  let range = useMemo(() => getNetworkLogRange(), []);
  let networkLogsQuery = useMemo(
    () => ({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      intervalMinutes: 60,
      direction: 'ingress' as const
    }),
    [range]
  );
  let networkLogs = useNetworkLogs(instance.data?.id, networkLogsQuery);

  return renderWithLoader({ networks, firewalls, networkLogs })(
    ({ firewalls, networkLogs }) => {
      let series = getNetworkLogSeries(networkLogs.data.records, range.from, range.to);
      let deniedCount = getDeniedNetworkLogCount(networkLogs.data.records);

      return (
        <>
          <Box
            title="Recent Connections"
            description="Ingress connections grouped by IP and result in 60-minute intervals over the last 24 hours."
          >
            {series.length > 0 ? (
              <Chart height={300} type="line" series={series} />
            ) : (
              <EmptyText>No network connections found in the last 24 hours.</EmptyText>
            )}

            {deniedCount > 0 ? (
              <>
                <Spacer size={12} />
                <Callout color="red">
                  {deniedCount} ingress {deniedCount === 1 ? 'request was' : 'requests were'}{' '}
                  denied by Metorial Magic Network policies.
                </Callout>
              </>
            ) : null}
          </Box>

          <Spacer size={20} />

          <Box title="Firewalls" description="Firewalls attached to this network.">
            {firewalls.data.items.length > 0 ? (
              <Table
                headers={['Name', 'Status', 'Policies', 'Network', 'Updated']}
                data={firewalls.data.items.map(firewall => ({
                  href: Paths.instance.networkFirewall(
                    organization.data,
                    project.data,
                    instance.data,
                    firewall.id
                  ),
                  data: [
                    <Text size="2" weight="strong">
                      {firewall.name}
                    </Text>,
                    <Badge
                      color={
                        firewall.status === 'active'
                          ? 'green'
                          : firewall.status === 'archived'
                            ? 'orange'
                            : 'gray'
                      }
                    >
                      {firewall.status}
                    </Badge>,
                    <Text size="2">{firewall.networkPolicies.length}</Text>,
                    <ID id={firewall.networkId} />,
                    <RenderDate date={firewall.updatedAt} />
                  ]
                }))}
              />
            ) : (
              <EmptyText>No firewalls configured.</EmptyText>
            )}
          </Box>
        </>
      );
    }
  );
};
