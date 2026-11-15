import { col, createDataList, f } from '@metorial/data-list';
import {
  useSandboxMachineEvents,
  type DashboardInstanceSandboxMachinesEventsListOutput
} from '@metorial/state';
import { Flex, Text, theme } from '@metorial/ui';
import {
  getSandboxMachineEventCopy,
  getSandboxMachineEventSourceLabel,
  sandboxMachineEventGroups,
  type SandboxMachineEventSource
} from '../shared/eventCopy';

type Event = DashboardInstanceSandboxMachinesEventsListOutput['items'][number];

let eventSources: SandboxMachineEventSource[] = ['agent', 'api', 'policy', 'guest', 'system'];

let eventScopes = [
  { id: 'all', label: 'All' },
  { id: 'machine', label: 'Machine' },
  { id: 'instance', label: 'Runtime' }
] as const;

let eventTypeOptions = sandboxMachineEventGroups.flatMap(group =>
  group.types.map(type => ({
    id: type,
    label: `${group.label} · ${getSandboxMachineEventCopy(type).sentence}`
  }))
);

export let SandboxMachineEventsTable = createDataList<{
  instanceId: string;
  machineId: string;
}>('sandbox-machine-events')
  .filters(() => ({
    type: f.select('type', 'Type', eventTypeOptions, { description: 'Filter by event type' }),
    source: f.select(
      'source',
      'Source',
      eventSources.map(id => ({ id, label: getSandboxMachineEventSourceLabel(id) })),
      { description: 'Filter by source' }
    ),
    scope: f.select('scope', 'Scope', eventScopes, { description: 'Filter by scope' })
  }))
  .paginated(({ props, filters }) =>
    useSandboxMachineEvents(
      props.instanceId,
      props.machineId,
      {
        order: 'desc',
        limit: 20,
        type: filters.type,
        source: filters.source,
        scope: filters.scope?.[0]
      },
      { pollInterval: 5000 }
    )
  )
  .columns([
    col.custom<Event>({
      id: 'event',
      header: 'Event',
      render: event => {
        let copy = getSandboxMachineEventCopy(event.type);
        let Icon = copy.icon;

        return (
          <Flex gap={10}>
            <Icon
              size={18}
              color={copy.isError ? theme.colors.red700 : theme.colors.gray700}
            />
            <Text size="2">{copy.sentence}</Text>
          </Flex>
        );
      }
    }),
    col.text<Event>({
      id: 'source',
      header: 'Source',
      get: event => getSandboxMachineEventSourceLabel(event.source)
    }),
    col.date<Event>('occurredAt', { id: 'time', header: 'Time', isDefault: true })
  ])
  .build();
