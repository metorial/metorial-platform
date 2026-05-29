import { useNavigate } from 'react-router-dom';
import { renderWithPagination } from '@metorial/data-hooks';
import { Avatar, Button, Text, Title, Flex, Spacer, Group, RenderDate } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useTenants } from '../../hooks';
import { EmptyState, MonoText } from '../../components/styled';

export let TenantList = () => {
  let navigate = useNavigate();
  let tenants = useTenants();

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">No tenants yet</Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        Create your first tenant to get started with Slates.
      </Text>
      <Spacer size={24} />
      <Button onClick={() => navigate('/tenants/new')}>
        + Create Tenant
      </Button>
    </EmptyState>
  );

  return renderWithPagination(tenants, { emptyState })(({ data }) => {
    let items = data.items;

    return (
      <Flex direction="column" gap={24}>
        <Flex justify="space-between" align="center">
          <div>
            <Title size="6" weight="strong">Tenants</Title>
            <Spacer size={4} />
            <Text size="2" color="gray600">Manage your organization tenants</Text>
          </div>
          <Button onClick={() => navigate('/tenants/new')}>
            + Create Tenant
          </Button>
        </Flex>

        <Group.Wrapper>
          <Table
            padding={{ sides: '20px' }}
            headers={['Tenant', 'Created']}
            data={items.map(tenant => ({
              href: `/tenants/${tenant.id}`,
              data: [
                <Flex align="center" gap={14}>
                  <Avatar entity={{ name: tenant.name }} size={32} withInitials radius={6} />
                  <div>
                    <Text size="2" weight="medium">{tenant.name}</Text>
                    <Text size="1" color="gray600">
                      <MonoText>{tenant.identifier}</MonoText>
                    </Text>
                  </div>
                </Flex>,
                <RenderDate date={tenant.createdAt} />
              ]
            }))}
          />
        </Group.Wrapper>
      </Flex>
    );
  });
}
