import { Chart } from '@metorial/chart';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthConfigs,
  useProviderAuthMethods,
  useProviderDeployment,
  useSessions
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  DatePicker,
  RenderDate,
  Select,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID, SideBox } from '@metorial/ui-product';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProviderAuthConfigsTable } from '../../../scenes/providerAuthConfigs/table';
import { showProviderSetupSessionModal } from '../../../scenes/providerDeployments/setupSessionModal';
import { SessionsTable } from '../../../scenes/sessions/table';

type Interval = { unit: 'day' | 'hour'; count: number };

let aggregateByInterval = (
  items: {
    createdAt: Date;
    usage?: {
      totalProductiveClientMessageCount: number;
      totalProductiveProviderMessageCount: number;
    };
  }[],
  from: Date,
  to: Date,
  interval: Interval
) => {
  let bucketKey = (date: Date): string => {
    if (interval.unit === 'day') {
      return date.toISOString().split('T')[0];
    }
    let hours = Math.floor(date.getHours() / interval.count) * interval.count;
    return `${date.toISOString().split('T')[0]}T${String(hours).padStart(2, '0')}:00`;
  };

  let buckets = new Map<string, number>();

  let cursor = new Date(from);
  while (cursor <= to) {
    buckets.set(bucketKey(cursor), 0);
    if (interval.unit === 'day') {
      cursor = new Date(cursor.getTime() + interval.count * 86400000);
    } else {
      cursor = new Date(cursor.getTime() + interval.count * 3600000);
    }
  }

  for (let item of items) {
    let d = new Date(item.createdAt);
    if (d < from || d > to) continue;
    let key = bucketKey(d);
    let msgs =
      (item.usage?.totalProductiveClientMessageCount ?? 0) +
      (item.usage?.totalProductiveProviderMessageCount ?? 0);
    buckets.set(key, (buckets.get(key) ?? 0) + msgs);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));
};

export let ProviderDeploymentOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(instance.data?.id, effectiveVersionId);
  let authConfigs = useProviderAuthConfigs(
    instance.data?.id,
    deployment.data?.id ?? providerDeploymentId
  );

  let hasAuthMethods = (authMethods.data?.items?.length ?? 0) > 0;

  let sessions = useSessions(instance.data?.id, {
    providerDeploymentId: deployment.data?.id ?? providerDeploymentId,
    order: 'desc',
    limit: 100
  });

  let [dateFrom, setDateFrom] = useState(() => startOfDay(subDays(new Date(), 7)));
  let [dateTo, setDateTo] = useState(() => endOfDay(new Date()));
  let [interval, setInterval] = useState<Interval>({ unit: 'day', count: 1 });

  let chartData = useMemo(() => {
    if (!sessions.data?.items?.length) return [];
    let entries = aggregateByInterval(sessions.data.items, dateFrom, dateTo, interval);
    return [{ id: 'messages', name: 'Messages', entries }];
  }, [sessions.data?.items, dateFrom, dateTo, interval]);

  return renderWithLoader({ deployment })(({ deployment }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: deployment.data.name ?? '—'
          },
          {
            label: 'Provider',
            content: deployment.data.providerId
          },
          {
            label: 'ID',
            content: <ID id={deployment.data.id} />
          },
          {
            label: 'Pinned Version',
            content: deployment.data.lockedVersion ? (
              <Badge color="blue">
                {deployment.data.lockedVersion.name} ({deployment.data.lockedVersion.version})
              </Badge>
            ) : (
              <Badge color="gray">Latest</Badge>
            )
          },
          {
            label: 'Default Config',
            content: deployment.data.defaultConfig?.name ?? '—'
          },
          {
            label: 'Created At',
            content: <RenderDate date={deployment.data.createdAt!} />
          },
          {
            label: 'Updated At',
            content: <RenderDate date={deployment.data.updatedAt!} />
          }
        ]}
      />

      <Spacer height={20} />

      <Box
        title="Messages"
        description="MCP messages processed over time for this deployment."
        rightActions={
          <>
            <DatePicker
              label="Date Range"
              hideLabel
              type="range"
              value={[dateFrom, dateTo]}
              onChange={([from, to]) => {
                setDateFrom(from);
                setDateTo(to);
              }}
            />
            <Select
              label="Interval"
              hideLabel
              items={[
                { id: '1-day', label: '1 Day' },
                { id: '1-hour', label: '1 Hour' },
                { id: '6-hour', label: '6 Hours' },
                { id: '12-hour', label: '12 Hours' }
              ]}
              value={`${interval.count}-${interval.unit}`}
              onChange={value => {
                let [count, unit] = value.split('-');
                setInterval({ count: Number(count), unit: unit as 'day' | 'hour' });
              }}
            />
          </>
        }
      >
        {chartData.length > 0 && chartData[0].entries.some(e => e.value > 0) ? (
          <Chart height={250} type="line" series={chartData} />
        ) : (
          <Text size="2" color="gray600">
            No message activity in this period.
          </Text>
        )}
      </Box>

      <Spacer height={20} />

      <Box title="Recent Sessions" description="Latest sessions using this deployment.">
        <SessionsTable providerDeploymentId={deployment.data.id} />
      </Box>

      {hasAuthMethods && (
        <>
          <Spacer height={20} />

          <SideBox
            title="Authentication"
            description="Manage auth configurations for this deployment."
          >
            <Button
              size="2"
              onClick={() => {
                if (!instance.data) return;
                showProviderSetupSessionModal({
                  instanceId: instance.data.id,
                  providerId: deployment.data.providerId,
                  deploymentId: deployment.data.id,
                  onComplete: () => authConfigs.refetch?.()
                });
              }}
            >
              Configure Authentication
            </Button>
          </SideBox>

          <Spacer height={15} />

          <ProviderAuthConfigsTable
            instanceId={instance.data!.id}
            providerDeploymentId={deployment.data.id}
          />
        </>
      )}
    </>
  ));
};
