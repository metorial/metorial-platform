import { renderWithPagination } from '@metorial/data-hooks';
import { useChatWorkspaces } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';

export let ChatWorkspacesTable = (p: { instanceId: string; chatInstanceId: string }) => {
  let workspaces = useChatWorkspaces(p.instanceId, p.chatInstanceId, { order: 'desc' });

  return renderWithPagination(workspaces, { hidePaginationWhenUnavailable: true })(workspaces => (
    <>
      <Table
        headers={['Name', 'Domain', 'Updated', 'ID']}
        data={workspaces.data.items.map(workspace => ({
          data: [
            <Text size="2" weight="strong">
              {workspace.name ?? workspace.providerWorkspaceId}
            </Text>,
            <Text size="2" color={workspace.domain ? undefined : 'gray600'}>
              {workspace.domain ?? '-'}
            </Text>,
            <RenderDate date={workspace.updatedAt} />,
            <ID id={workspace.id} />
          ]
        }))}
      />

      {workspaces.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No workspaces have been synced for this chat instance yet.
        </Text>
      )}
    </>
  ));
};
