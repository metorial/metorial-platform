import { Chart } from '@metorial/chart';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentOrganization, useInstances } from '@metorial/state';
import { DatePicker, Select } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useUsageState } from './state';

export let UsageScene = ({
  title,
  description,
  entities,
  from,
  interval,
  entityNames,
  labelBy = 'entity'
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  entities: {
    type: string;
    id?: string;
  }[];
  from?: number;
  interval?: {
    unit: 'day' | 'hour';
    count: number;
  };
  entityNames: Record<string, string>;
  labelBy?: 'entity' | 'owner';
}) => {
  let isUsageIntervalUnit = (value: string): value is 'day' | 'hour' => {
    return value === 'day' || value === 'hour';
  };

  let formatEntityTypeName = (entityType: string) =>
    entityType
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  let organization = useCurrentOrganization();
  let instances = useInstances(labelBy === 'owner' ? organization.data?.id : null);

  let ownerNames = new Map<string, string>();
  if (organization.data) {
    ownerNames.set(organization.data.id, organization.data.name);
  }

  let instanceItems = instances.data ?? [];
  let nameCounts = new Map<string, number>();
  for (let i of instanceItems) {
    nameCounts.set(i.name, (nameCounts.get(i.name) ?? 0) + 1);
  }
  for (let i of instanceItems) {
    let needsDisambiguation = (nameCounts.get(i.name) ?? 0) > 1;
    let label =
      needsDisambiguation && i.project?.name ? `${i.project.name} / ${i.name}` : i.name;
    ownerNames.set(i.id, label);
  }

  let getSeriesName = (timeline: {
    entityId: string;
    entityType: string;
    ownerId: string;
  }) => {
    if (labelBy === 'owner') {
      return ownerNames.get(timeline.ownerId) ?? timeline.ownerId;
    }

    return (
      entityNames[timeline.entityId] ??
      entityNames[`type:${timeline.entityType}`] ??
      entityNames[timeline.entityType] ??
      (timeline.entityId === 'all'
        ? `All ${formatEntityTypeName(timeline.entityType)}`
        : timeline.entityId)
    );
  };

  let [usage, range] = useUsageState({
    entities,
    from,
    interval
  });

  return (
    <Box
      title={title}
      description={description}
      rightActions={
        <>
          <DatePicker
            label="Date Range"
            hideLabel
            type="range"
            value={[range.from, range.to]}
            onChange={([from, to]) => {
              range.setFrom(from);
              range.setTo(to);
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
            value={`${range.interval.count}-${range.interval.unit}`}
            onChange={value => {
              let [count, unit] = value.split('-');
              if (!isUsageIntervalUnit(unit)) return;
              range.setInterval({ count: Number(count), unit });
            }}
          />
        </>
      }
    >
      {Array.isArray(entities) && !entities.length ? (
        <>
          <p>
            There has been any usage yet. Once you start using Metorial, you'll see usage data
            here.
          </p>
        </>
      ) : (
        renderWithLoader({ usage })(({ usage }) => (
          <Chart
            height={300}
            type="line"
            series={usage.data.map(tl => ({
              id: `${tl.ownerId}:${tl.entityType}:${tl.entityId}`,
              name: getSeriesName(tl),
              entries: tl.entries.map(e => ({ key: e.ts, value: e.count }))
            }))}
          />
        ))
      )}
    </Box>
  );
};
