import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { useCurrentInstance, usePublicMcpServer } from '@metorial/state';
import { Callout, Copy, Datalist, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

let formatDuration = (seconds: number) => {
  if (seconds % 86400 == 0) return `${seconds / 86400} day${seconds == 86400 ? '' : 's'}`;
  if (seconds % 3600 == 0) return `${seconds / 3600} hour${seconds == 3600 ? '' : 's'}`;
  if (seconds % 60 == 0) return `${seconds / 60} minute${seconds == 60 ? '' : 's'}`;
  return `${seconds} seconds`;
};

export let PublicMcpServerOverviewPage = () => {
  let instance = useCurrentInstance();
  let { publicMcpServerId } = useParams();
  let server = usePublicMcpServer(instance.data?.id, publicMcpServerId);

  return renderWithLoader({ server })(({ server }) => (
    <DetailsOverviewLayout>
      {server.data.status == 'disabled' && (
        <>
          <Callout color="orange">
            This server is disabled. Clients can't connect until you enable it again.
          </Callout>
          <Spacer height={20} />
        </>
      )}

      <Box
        title={`Connect to ${server.data.name}`}
        description="Add this URL to any MCP client. Users are asked to sign in and connect their own account the first time."
      >
        <Copy label="Connect URL" value={server.data.connectUrl} />

        {server.data.alternateConnectUrls.length > 0 && (
          <>
            <Spacer height={15} />
            <Text size="2" weight="strong">
              Alternate URLs
            </Text>
            <Spacer height={8} />
            {server.data.alternateConnectUrls.map(url => (
              <div key={url} style={{ marginBottom: 8 }}>
                <Copy value={url} />
              </div>
            ))}
          </>
        )}
      </Box>

      <Spacer height={20} />

      <Box title="Access Policy" description="How long users stay connected to this server.">
        <Datalist
          items={[
            {
              label: 'Access token lifetime',
              value: formatDuration(server.data.accessTokenTtlSeconds)
            },
            {
              label: 'Refresh token lifetime',
              value: formatDuration(server.data.refreshTokenTtlSeconds)
            },
            {
              label: 'Disconnect after inactivity',
              value: formatDuration(server.data.grantIdleExpirySeconds)
            },
            {
              label: 'Maximum connected users',
              value: server.data.maxActiveGrants ?? 'Unlimited'
            },
            {
              label: 'Allowed redirect URIs',
              value: server.data.redirectUriFilters.length
                ? server.data.redirectUriFilters.join(', ')
                : 'Any'
            }
          ]}
        />
      </Box>
    </DetailsOverviewLayout>
  ));
};
