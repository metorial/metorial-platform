import { col, createDataList, EmptyValue, withDefaults } from '@metorial/data-list';
import { usePublicMcpServerClients } from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';

let authMethodLabels = {
  client_secret_basic: 'Client secret (basic)',
  client_secret_post: 'Client secret (post)',
  none: 'Public client'
} as const;

let PublicMcpClientsList = createDataList<{ instanceId: string; publicMcpServerId: string }>(
  'public-mcp-server-clients'
)
  .paginated(({ props, limit }) =>
    usePublicMcpServerClients(
      props.instanceId,
      props.publicMcpServerId,
      withDefaults({ order: 'desc' as const }, { limit })
    )
  )
  .columns([
    col.name({
      id: 'client',
      header: 'Client',
      get: row => row.name,
      description: row => row.clientUri
    }),
    col.custom({
      id: 'type',
      header: 'Type',
      render: row => (
        <Badge size="2" color="gray">
          {authMethodLabels[row.tokenEndpointAuthMethod]}
        </Badge>
      )
    }),
    col.text({
      id: 'redirectUris',
      header: 'Redirect URIs',
      get: row => row.redirectUris.join(', ')
    }),
    col.custom({
      id: 'lastUsedAt',
      header: 'Last Used',
      render: row =>
        row.lastUsedAt ? <RenderDate date={row.lastUsedAt} /> : <EmptyValue>Never</EmptyValue>
    }),
    col.createdAt({ header: 'Registered' })
  ])
  .build();

export let PublicMcpClientsTable = (props: {
  instanceId: string;
  publicMcpServerId: string;
}) => (
  <PublicMcpClientsList
    emptyState="No MCP clients have registered with this server yet."
    {...props}
  />
);
