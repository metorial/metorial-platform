import { renderWithPagination } from '@metorial-io/data-hooks';
import { Badge, Flex, Group, Spacer, Text, Title } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { styled } from 'styled-components';
import { EmptyState, SlateLogoPlaceholder } from '../../components/styled.js';
import { versionStatusColors } from '../../constants/statusColors.js';
import { useSlates } from '../../state/index.js';

let SlateIcon = styled(SlateLogoPlaceholder)`
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-weight: 600;
`;

export let SlateList = () => {
  let slates = useSlates();

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">
        No slates found
      </Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        No slates have been registered in the hub yet.
      </Text>
    </EmptyState>
  );

  return (
    <Flex direction="column" gap={32}>
      <Flex justify="space-between" align="center">
        <div>
          <Title size="6" weight="strong">
            Slates
          </Title>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            All slates registered in the hub. View versions, deployments, and events.
          </Text>
        </div>
      </Flex>

      {renderWithPagination(slates, { emptyState })(({ data }) => {
        let items = data.items;

        return (
          <Group.Wrapper>
            <Table
              padding={{ sides: '20px' }}
              headers={['Slate', 'Version', 'Status']}
              data={items.map(slate => {
                let displayName = slate.name || slate.identifier;
                let initial = displayName.charAt(0).toUpperCase();

                return {
                  href: `/slates/${slate.id}`,
                  data: [
                    <Flex align="center" gap={14}>
                      <SlateIcon align="center" justify="center">
                        {initial}
                      </SlateIcon>
                      <Flex direction="column">
                        <Text size="2" weight="strong">
                          {displayName}
                        </Text>
                        <Text size="1" color="gray600">
                          {slate.slate?.fullIdentifier || slate.identifier}
                        </Text>
                      </Flex>
                    </Flex>,
                    slate.currentVersion ? (
                      <Badge color="blue">v{slate.currentVersion.version}</Badge>
                    ) : (
                      <Text size="2" color="gray500">
                        -
                      </Text>
                    ),
                    <Badge
                      color={
                        slate.currentVersion?.status
                          ? versionStatusColors[slate.currentVersion.status] || 'gray'
                          : 'gray'
                      }
                    >
                      {slate.currentVersion?.status ?? 'no version'}
                    </Badge>
                  ]
                };
              })}
            />
          </Group.Wrapper>
        );
      })}
    </Flex>
  );
};
