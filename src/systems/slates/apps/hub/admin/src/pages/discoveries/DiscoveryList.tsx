import { renderWithPagination } from '@metorial-io/data-hooks';
import { Badge, Flex, Group, RenderDate, Spacer, Text, Title } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink.js';
import { EmptyState, FilterButton } from '../../components/styled.js';
import { discoveryStatusColors } from '../../constants/statusColors.js';
import { useAllDiscoveries, useSlate, useSlateDiscoveries } from '../../state/index.js';

type StatusFilter = 'all' | 'succeeded' | 'failed';

export let DiscoveryList = () => {
  let { slateId } = useParams<{ slateId?: string }>();
  let [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  let slate = useSlate(slateId);
  let allDiscoveries = useAllDiscoveries(statusFilter === 'all' ? undefined : statusFilter);
  let slateDiscoveries = useSlateDiscoveries(slateId);

  let discoveries = slateId ? slateDiscoveries : allDiscoveries;
  let slateName = slate.data?.name || slate.data?.identifier;

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">
        No discoveries found
      </Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        {statusFilter === 'all'
          ? 'No slate discoveries have been recorded yet.'
          : `No discoveries with status "${statusFilter}" found.`}
      </Text>
    </EmptyState>
  );

  return (
    <Flex direction="column" gap={32}>
      {slateId && (
        <BackLink to={`/slates/${slateId}`}>Back to {slateName || 'Slate'}</BackLink>
      )}

      <Flex justify="space-between" align="center">
        <div>
          <Title size="6" weight="strong">
            {slateId ? `Discoveries for ${slateName || 'Slate'}` : 'Discoveries'}
          </Title>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            {slateId
              ? 'All discoveries for this slate.'
              : 'View slate discovery processes that introspect slate capabilities.'}
          </Text>
        </div>
      </Flex>

      <Flex gap={8}>
        <FilterButton $active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
          All
        </FilterButton>
        <FilterButton
          $active={statusFilter === 'succeeded'}
          onClick={() => setStatusFilter('succeeded')}
        >
          Succeeded
        </FilterButton>
        <FilterButton
          $active={statusFilter === 'failed'}
          onClick={() => setStatusFilter('failed')}
        >
          Failed
        </FilterButton>
      </Flex>

      {renderWithPagination(discoveries, { emptyState })(({ data }) => {
        let items = data.items;

        return (
          <Group.Wrapper>
            <Table
              padding={{ sides: '20px' }}
              headers={['Slate', 'Version', 'Status', 'Error', 'Created']}
              data={items.map(discovery => ({
                href: `/slates/${discovery.slate?.id}/versions/${discovery.version?.id}/discoveries/${discovery.id}`,
                data: [
                  <Flex direction="column">
                    <Text size="2" weight="strong">
                      {discovery.slate?.name ?? discovery.slate?.identifier ?? '-'}
                    </Text>
                    <Text size="1" color="gray600" style={{ fontFamily: 'monospace' }}>
                      {discovery.id.slice(0, 16)}...
                    </Text>
                  </Flex>,
                  <Badge color="blue">v{discovery.version?.version ?? '-'}</Badge>,
                  <Badge color={discoveryStatusColors[discovery.status] || 'gray'}>
                    {discovery.status}
                  </Badge>,
                  discovery.error ? (
                    <Flex direction="column" gap={2}>
                      <Text size="1" weight="medium" color="red600">
                        {discovery.error.code}
                      </Text>
                      <Text
                        size="1"
                        color="gray600"
                        style={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {discovery.error.message}
                      </Text>
                    </Flex>
                  ) : (
                    <Text size="2" color="gray600">
                      -
                    </Text>
                  ),
                  <RenderDate date={discovery.createdAt} />
                ]
              }))}
            />
          </Group.Wrapper>
        );
      })}
    </Flex>
  );
};
