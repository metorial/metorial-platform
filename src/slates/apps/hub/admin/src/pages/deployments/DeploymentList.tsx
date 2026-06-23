import { renderWithPagination } from '@metorial-io/data-hooks';
import { Badge, Flex, Group, RenderDate, Spacer, Text, Title } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink.js';
import { EmptyState, FilterButton } from '../../components/styled.js';
import { deploymentStatusColors } from '../../constants/statusColors.js';
import { useAllDeployments, useSlate, useSlateDeployments } from '../../state/index.js';

type StatusFilter = 'all' | 'pending' | 'running' | 'succeeded' | 'failed';

export let DeploymentList = () => {
  let { slateId } = useParams<{ slateId?: string }>();
  let [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  let slate = useSlate(slateId);
  let allDeployments = useAllDeployments(statusFilter === 'all' ? undefined : statusFilter);
  let slateDeployments = useSlateDeployments(slateId);

  let deployments = slateId ? slateDeployments : allDeployments;
  let slateName = slate.data?.name || slate.data?.identifier;

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">
        No deployments found
      </Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        {statusFilter === 'all'
          ? 'No deployments have been recorded yet.'
          : `No deployments with status "${statusFilter}" found.`}
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
            {slateId ? `Deployments for ${slateName || 'Slate'}` : 'Deployments'}
          </Title>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            {slateId
              ? `All deployments for this slate.`
              : 'View and monitor all slate deployments across the hub.'}
          </Text>
        </div>
      </Flex>

      <Flex gap={8}>
        <FilterButton $active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
          All
        </FilterButton>
        <FilterButton
          $active={statusFilter === 'pending'}
          onClick={() => setStatusFilter('pending')}
        >
          Pending
        </FilterButton>
        <FilterButton
          $active={statusFilter === 'running'}
          onClick={() => setStatusFilter('running')}
        >
          Running
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

      {renderWithPagination(deployments, { emptyState })(({ data }) => {
        let items = data.items;

        return (
          <Group.Wrapper>
            <Table
              padding={{ sides: '20px' }}
              headers={['Slate', 'Version', 'Status', 'Created']}
              data={items.map(deployment => ({
                href: `/slates/${deployment.slate?.id || deployment.version?.slateId}/deployments/${deployment.id}`,
                data: [
                  <Flex direction="column">
                    <Text size="2" weight="strong">
                      {deployment.slate?.name ??
                        deployment.slate?.identifier ??
                        `v${deployment.version?.version ?? '-'}`}
                    </Text>
                    <Text size="1" color="gray600" style={{ fontFamily: 'monospace' }}>
                      {deployment.id.slice(0, 16)}...
                    </Text>
                  </Flex>,
                  <Badge color="blue">v{deployment.version?.version ?? '-'}</Badge>,
                  <Flex direction="column" gap={4}>
                    <Badge color={deploymentStatusColors[deployment.status] || 'gray'}>
                      {deployment.status}
                    </Badge>
                    {deployment.error && (
                      <Text
                        size="1"
                        color="red600"
                        style={{
                          maxWidth: 160,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {deployment.error.code}
                      </Text>
                    )}
                  </Flex>,
                  <RenderDate date={deployment.createdAt} />
                ]
              }))}
            />
          </Group.Wrapper>
        );
      })}
    </Flex>
  );
};
