import { col, createDataList } from '@metorial/data-list';
import { useChatWorkspaces } from '@metorial/state';

let ChatWorkspacesList = createDataList<{ instanceId: string; chatInstanceId: string }>(
  'chat-workspaces'
)
  .paginated(({ props }) =>
    useChatWorkspaces(props.instanceId, props.chatInstanceId, { order: 'desc' })
  )
  .columns([
    col.text({
      id: 'name',
      header: 'Name',
      weight: 'strong',
      get: row => row.name ?? row.providerWorkspaceId
    }),
    col.text({ id: 'domain', header: 'Domain', get: row => row.domain }),
    col.id({ isDefault: true })
  ])
  .build();

export let ChatWorkspacesTable = (p: { instanceId: string; chatInstanceId: string }) => (
  <ChatWorkspacesList
    {...p}
    listVariant="embedded"
    hideToolbar
    emptyState="No workspaces have been synced for this chat instance yet."
  />
);
