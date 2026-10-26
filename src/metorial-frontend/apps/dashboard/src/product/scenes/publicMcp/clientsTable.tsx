import { renderWithPagination } from '@metorial/data-hooks';
import { usePublicMcpServerClients } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

let authMethodLabels = {
  client_secret_basic: 'Client secret (basic)',
  client_secret_post: 'Client secret (post)',
  none: 'Public client'
} as const;

export let PublicMcpClientsTable = ({
  instanceId,
  publicMcpServerId
}: {
  instanceId: string;
  publicMcpServerId: string;
}) => {
  let clients = usePublicMcpServerClients(instanceId, publicMcpServerId, { order: 'desc' });

  return renderWithPagination(clients)(clients => (
    <>
      <Table
        headers={['Client', 'Type', 'Redirect URIs', 'Last Used', 'Registered']}
        data={clients.data.items.map(client => ({
          data: [
            <div>
              <Text size="2" weight="strong">
                {client.name}
              </Text>
              {client.clientUri && (
                <Text size="1" color="gray600">
                  {client.clientUri}
                </Text>
              )}
            </div>,
            <Badge size="2" color="gray">
              {authMethodLabels[client.tokenEndpointAuthMethod]}
            </Badge>,
            <Text size="2" color="gray700">
              {client.redirectUris.join(', ')}
            </Text>,
            client.lastUsedAt ? (
              <RenderDate date={client.lastUsedAt} />
            ) : (
              <Text size="2" color="gray600">
                Never
              </Text>
            ),
            <RenderDate date={client.createdAt} />
          ]
        }))}
      />

      {clients.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No MCP clients have registered with this server yet.
        </Text>
      )}
    </>
  ));
};
