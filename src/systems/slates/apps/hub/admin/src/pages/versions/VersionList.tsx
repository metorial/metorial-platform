import { renderWithPagination } from '@metorial/data-hooks';
import { Badge, Flex, Group, RenderDate, Spacer, Text, Title } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink.js';
import { EmptyState } from '../../components/styled.js';
import { versionStatusColors } from '../../constants/statusColors.js';
import { useSlate, useSlateVersions } from '../../state/index.js';

export let VersionList = () => {
  let { slateId } = useParams<{ slateId: string }>();

  let slate = useSlate(slateId);
  let versions = useSlateVersions(slateId);

  let slateName = slate.data?.name || slate.data?.identifier;

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">
        No versions found
      </Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        No versions have been created for this slate yet.
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
            Versions for {slateName || 'Slate'}
          </Title>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            All versions for this slate.
          </Text>
        </div>
      </Flex>

      {renderWithPagination(versions, { emptyState })(({ data }) => {
        let items = data.items;

        return (
          <Group.Wrapper>
            <Table
              padding={{ sides: '20px' }}
              headers={['Version', 'Status', 'Current', 'Created']}
              data={items.map(version => ({
                href: `/slates/${slateId}/versions/${version.id}`,
                data: [
                  <Text size="3" weight="bold" style={{ fontFamily: 'monospace' }}>
                    v{version.version}
                  </Text>,
                  <Badge color={versionStatusColors[version.status] || 'gray'}>
                    {version.status}
                  </Badge>,
                  version.isCurrent ? (
                    <Badge color="green" size="1">
                      Current
                    </Badge>
                  ) : (
                    <Text size="2" color="gray600">
                      -
                    </Text>
                  ),
                  <RenderDate date={version.createdAt} />
                ]
              }))}
            />
          </Group.Wrapper>
        );
      })}
    </Flex>
  );
};
