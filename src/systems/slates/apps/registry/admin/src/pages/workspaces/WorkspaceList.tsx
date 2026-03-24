import { useNavigate, useParams } from 'react-router-dom';
import { renderWithPagination } from '@metorial-io/data-hooks';
import { Avatar, Button, Text, Title, Badge, Flex, Spacer, Group, RenderDate } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useWorkspaces } from '../../hooks';
import { EmptyState, MonoText } from '../../components/styled';

export let WorkspaceList = () => {
  let navigate = useNavigate();
  let { tenantId } = useParams<{ tenantId: string }>();
  let workspaces = useWorkspaces(tenantId);

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">No workspaces yet</Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        Create your first workspace to organize slates.
      </Text>
      <Spacer size={24} />
      <Button onClick={() => navigate(`/tenants/${tenantId}/workspaces/new`)}>
        + Create Workspace
      </Button>
    </EmptyState>
  );

  return renderWithPagination(workspaces, { emptyState })(({ data }) => {
    let items = data.items;

    return (
      <Flex direction="column" gap={24}>
        <Flex justify="space-between" align="center">
          <div>
            <Title size="6" weight="strong">Workspaces</Title>
            <Spacer size={4} />
            <Text size="2" color="gray600">Workspaces are shared scopes for teams. Slates published under a workspace (@workspace-name) can be managed by multiple users.</Text>
          </div>
          <Button onClick={() => navigate(`/tenants/${tenantId}/workspaces/new`)}>
            + Create Workspace
          </Button>
        </Flex>

        <Group.Wrapper>
          <Table
            padding={{ sides: '20px' }}
            headers={['Workspace', 'Status', 'Created']}
            data={items.map(workspace => ({
              href: `/tenants/${tenantId}/workspaces/${workspace.id}/edit`,
              data: [
                <Flex align="center" gap={14}>
                  <Avatar entity={{ name: workspace.name }} size={32} withInitials radius={6} />
                  <div>
                    <Text size="2" weight="medium">{workspace.name}</Text>
                    <Text size="1" color="gray600">
                      <MonoText>{workspace.identifier}</MonoText>
                    </Text>
                  </div>
                </Flex>,
                <Badge color={workspace.status === 'active' ? 'green' : 'gray'} size="1">
                  {workspace.status}
                </Badge>,
                <RenderDate date={workspace.createdAt} />
              ]
            }))}
          />
        </Group.Wrapper>
      </Flex>
    );
  });
}
