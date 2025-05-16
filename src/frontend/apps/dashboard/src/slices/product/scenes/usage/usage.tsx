import { Chart } from '@metorial/chart';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentOrganization } from '@metorial/state';
import { DatePicker, Select } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useUsageState } from './state';

export let UsageScene = ({
  title,
  description,
  entities,
  from,
  interval,
  entityNames
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  entities: {
    type: string;
    id: string;
  }[];
  from?: number;
  interval?: {
    unit: 'day' | 'hour';
    count: number;
  };
  entityNames: Record<string, string>;
}) => {
  let org = useCurrentOrganization();
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
              range.setInterval({ count: Number(count), unit: unit as any });
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
              id: tl.entityId,
              name: entityNames[tl.entityId] ?? tl.entityId,
              entries: tl.entries.map(e => ({ key: e.ts, value: e.count }))
            }))}
          />
        ))
      )}
    </Box>
  );
};
