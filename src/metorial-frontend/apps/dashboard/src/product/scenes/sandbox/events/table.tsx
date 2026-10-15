import {
  useSandboxMachineEvents,
  type DashboardInstanceSandboxMachinesEventsListOutput
} from '@metorial/state';
import {
  Table,
  getEnumListFilterValue,
  getStringFilterValue,
  type TableStateProviderResult
} from '@metorial/table';
import { RenderDate, Flex, Text, theme } from '@metorial/ui';
import {
  getSandboxMachineEventCopy,
  getSandboxMachineEventSourceLabel,
  sandboxMachineEventGroups,
  sandboxMachineEventTypes
} from '../shared/eventCopy';

type Event = DashboardInstanceSandboxMachinesEventsListOutput['items'][number];

export let SandboxMachineEventsTable = new Table('sandbox-machine-events')
  .state<{ instanceId: string; machineId: string }, Event, TableStateProviderResult<Event>>(
    (props, opts) => {
      let events = useSandboxMachineEvents(
        props.instanceId,
        props.machineId,
        {
          order: 'desc',
          limit: 20,
          type: getEnumListFilterValue(opts.filter.type, sandboxMachineEventTypes),
          source: getEnumListFilterValue(opts.filter.source, [
            'agent',
            'api',
            'policy',
            'guest',
            'system'
          ]),
          scope: getStringFilterValue(opts.filter.scope) as
            | 'all'
            | 'machine'
            | 'instance'
            | undefined
        },
        { pollInterval: 5000 }
      );

      return {
        isLoading: events.isLoading,
        error: events.error,
        items: events.data?.items ?? [],
        hasMoreAfter: events.data?.pagination.hasMoreAfter ?? false,
        hasMoreBefore: events.data?.pagination.hasMoreBefore ?? false,
        loadNext: events.next,
        loadPrevious: events.previous
      };
    }
  )
  .columns([
    {
      id: 'event',
      header: 'Event',
      isDefault: true,
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
    },
    {
      id: 'source',
      header: 'Source',
      isDefault: true,
      render: event => getSandboxMachineEventSourceLabel(event.source)
    },
    {
      id: 'time',
      header: 'Time',
      isDefault: true,
      render: event => <RenderDate date={event.occurredAt} />
    }
  ])
  .filters([
    {
      id: 'type',
      fields: ['type'],
      label: 'Type',
      description: 'Filter by event type',
      type: 'select',
      options: sandboxMachineEventGroups.flatMap(group =>
        group.types.map(type => ({
          id: type,
          label: `${group.label} · ${getSandboxMachineEventCopy(type).sentence}`
        }))
      )
    },
    {
      id: 'source',
      fields: ['source'],
      label: 'Source',
      description: 'Filter by source',
      type: 'select',
      options: ['agent', 'api', 'policy', 'guest', 'system'].map(id => ({
        id,
        label: getSandboxMachineEventSourceLabel(id)
      }))
    },
    {
      id: 'scope',
      fields: ['scope'],
      label: 'Scope',
      description: 'Filter by scope',
      type: 'select',
      options: [
        { id: 'all', label: 'All' },
        { id: 'machine', label: 'Machine' },
        { id: 'instance', label: 'Runtime' }
      ]
    }
  ])
  .build();
