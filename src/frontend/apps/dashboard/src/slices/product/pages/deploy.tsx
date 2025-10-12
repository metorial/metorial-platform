import { SetupLayout } from '@metorial/layout';
import { useCurrentInstance, useDashboardFlags, useServerListing } from '@metorial/state';
import { useSearchParams } from 'react-router-dom';
import bg from '../../../assets/bg.webp';
import { MagicMcpServerForm, ServerDeploymentForm } from '../scenes/serverDeployments/form';

export let DeployPage = () => {
  let instance = useCurrentInstance();

  let [search] = useSearchParams();
  let serverId = search.get('server_id');
  let nextUrl = search.get('next_url');

  let flags = useDashboardFlags();

  let serverListing = useServerListing(instance.data?.id, serverId);

  return (
    <SetupLayout
      main={
        serverListing.data
          ? {
              title: `Deploy ${serverListing.data.name}`,
              description: `Let's set up your Magic MCP server.`
            }
          : undefined
      }
      backgroundUrl={bg}
    >
      {serverId && (
        <>
          {flags.data?.flags['magic-mcp-enabled'] ? (
            <MagicMcpServerForm
              type="create"
              for={{ serverId }}
              onCreate={nextUrl ? () => location.replace(nextUrl) : undefined}
            />
          ) : (
            <ServerDeploymentForm
              type="create"
              for={{ serverId }}
              onCreate={nextUrl ? () => location.replace(nextUrl) : undefined}
            />
          )}
        </>
      )}
    </SetupLayout>
  );
};
