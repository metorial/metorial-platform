import { useNavigate, useParams } from 'react-router-dom';
import { renderWithPagination } from '@metorial/data-hooks';
import { Avatar, Button, Text, Title, Flex, Spacer, Badge, Group, RenderDate } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useSubRegistries } from '../../hooks';
import { EmptyState, MonoText } from '../../components/styled';

export let SubRegistryList = () => {
  let navigate = useNavigate();
  let { tenantId } = useParams<{ tenantId: string }>();
  let subRegistries = useSubRegistries(tenantId);

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">No sub-registries yet</Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        Create your first sub-registry to organize slate access.
      </Text>
      <Spacer size={24} />
      <Button onClick={() => navigate(`/tenants/${tenantId}/sub-registries/new`)}>
        + Create Sub-Registry
      </Button>
    </EmptyState>
  );

  return renderWithPagination(subRegistries, { emptyState })(({ data }) => {
    let items = data.items;

    return (
      <Flex direction="column" gap={24}>
        <Flex justify="space-between" align="center">
          <div>
            <Title size="6" weight="strong">Sub-Registries</Title>
            <Spacer size={4} />
            <Text size="2" color="gray600">Sub-registries are filtered views of slates. Use filters to control which slates are visible to different audiences.</Text>
          </div>
          <Button onClick={() => navigate(`/tenants/${tenantId}/sub-registries/new`)}>
            + Create Sub-Registry
          </Button>
        </Flex>

        <Group.Wrapper>
          <Table
            padding={{ sides: '20px' }}
            headers={['Sub-Registry', 'Filters', 'Created']}
            data={items.map(subRegistry => ({
              href: `/tenants/${tenantId}/sub-registries/${subRegistry.id}`,
              data: [
                <Flex align="center" gap={14}>
                  <Avatar entity={{ name: subRegistry.name }} size={32} withInitials radius={6} />
                  <div>
                    <Text size="2" weight="medium">{subRegistry.name}</Text>
                    <Text size="1" color="gray600">
                      <MonoText>{subRegistry.identifier}</MonoText>
                    </Text>
                  </div>
                </Flex>,
                <Badge color="blue" size="1">{subRegistry.filters?.length ?? 0} filters</Badge>,
                <RenderDate date={subRegistry.createdAt} />
              ]
            }))}
          />
        </Group.Wrapper>
      </Flex>
    );
  });
}
