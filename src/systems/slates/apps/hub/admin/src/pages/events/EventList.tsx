import { renderWithPagination } from '@metorial/data-hooks';
import { Badge, Flex, Group, RenderDate, Spacer, Text, Title } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink.js';
import { EmptyState, FilterButton } from '../../components/styled.js';
import { eventTypeColors } from '../../constants/statusColors.js';
import { useAllEvents, useSlate, useSlateEvents } from '../../state/index.js';

type EventFilter = 'all' | 'deployment' | 'discovery' | 'version';

export let EventList = () => {
  let { slateId } = useParams<{ slateId?: string }>();
  let [typeFilter, setTypeFilter] = useState<EventFilter>('all');

  let slate = useSlate(slateId);
  let allEvents = useAllEvents();
  let slateEvents = useSlateEvents(slateId);

  let events = slateId ? slateEvents : allEvents;
  let slateName = slate.data?.name || slate.data?.identifier;

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">
        No events found
      </Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        {typeFilter === 'all'
          ? 'No events have been recorded yet.'
          : `No ${typeFilter} events found.`}
      </Text>
    </EmptyState>
  );

  let getEventHref = (event: NonNullable<(typeof events)['data']>['items'][number]) => {
    if (event.type.startsWith('deployment') && event.deployment) {
      return `/slates/${event.slate?.id}/deployments/${event.deployment.id}`;
    }
    if (event.type.startsWith('discovery') && event.discovery) {
      return `/slates/${event.slate?.id}/versions/${event.version?.id}/discoveries/${event.discovery.id}`;
    }
    if (event.slate) {
      return `/slates/${event.slate.id}`;
    }
    return undefined;
  };

  return (
    <Flex direction="column" gap={32}>
      {slateId && (
        <BackLink to={`/slates/${slateId}`}>Back to {slateName || 'Slate'}</BackLink>
      )}

      <Flex justify="space-between" align="center">
        <div>
          <Title size="6" weight="strong">
            {slateId ? `Events for ${slateName || 'Slate'}` : 'Events'}
          </Title>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            {slateId
              ? 'All events for this slate.'
              : 'Timeline of all slate events including deployments, discoveries, and version changes.'}
          </Text>
        </div>
      </Flex>

      <Flex gap={8}>
        <FilterButton $active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
          All Events
        </FilterButton>
        <FilterButton
          $active={typeFilter === 'deployment'}
          onClick={() => setTypeFilter('deployment')}
        >
          Deployments
        </FilterButton>
        <FilterButton
          $active={typeFilter === 'discovery'}
          onClick={() => setTypeFilter('discovery')}
        >
          Discoveries
        </FilterButton>
        <FilterButton
          $active={typeFilter === 'version'}
          onClick={() => setTypeFilter('version')}
        >
          Version Changes
        </FilterButton>
      </Flex>

      {renderWithPagination(events, { emptyState })(({ data }) => {
        let items = data.items;
        let filteredEvents =
          typeFilter === 'all' ? items : items.filter(e => e.type.startsWith(typeFilter));

        if (filteredEvents.length === 0) {
          return emptyState;
        }

        let headers = slateId
          ? ['Type', 'Message', 'Version', 'Time']
          : ['Type', 'Message', 'Slate', 'Version', 'Time'];

        return (
          <Group.Wrapper>
            <Table
              padding={{ sides: '20px' }}
              headers={headers}
              data={filteredEvents.map(event => {
                let href = getEventHref(event);
                let row = {
                  href,
                  data: [
                    <Badge color={eventTypeColors[event.type] || 'gray'}>
                      {event.type.replace(/_/g, ' ')}
                    </Badge>,
                    <Text size="2" color={event.message ? undefined : 'gray600'}>
                      {event.message || '-'}
                    </Text>,
                    ...(!slateId
                      ? [
                          event.slate ? (
                            <Text size="2">{event.slate.name || event.slate.identifier}</Text>
                          ) : (
                            <Text size="2" color="gray600">
                              -
                            </Text>
                          )
                        ]
                      : []),
                    <Badge color="blue" size="1">
                      v{event.version?.version ?? '-'}
                    </Badge>,
                    <RenderDate date={event.createdAt} />
                  ]
                };
                return row;
              })}
            />
          </Group.Wrapper>
        );
      })}
    </Flex>
  );
};
