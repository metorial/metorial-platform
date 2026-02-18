import { Paths } from '@metorial/frontend-config';
import { SetupLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useDashboardFlags,
  useProvider,
  useProviderListing
} from '@metorial/state';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import bg from '../../../assets/bg.webp';
import { MagicMcpServerForm, ServerDeploymentForm } from '../scenes/serverDeployments/form';

export let DeployPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let [search] = useSearchParams();
  let serverId = search.get('server_id');
  let providerId = search.get('provider_id');
  let nextUrl = search.get('next_url');

  let flags = useDashboardFlags();

  useEffect(() => {
    if (providerId && instance.data) {
      let setupUrl = Paths.instance.setupProvider(
        instance.data.organization,
        instance.data.project,
        instance.data,
        providerId
      );
      if (nextUrl) {
        setupUrl = `${setupUrl}&next_url=${encodeURIComponent(nextUrl)}`;
      }
      navigate(setupUrl, { replace: true });
    }
  }, [providerId, instance.data, nextUrl, navigate]);

  // legacy
  let serverListing = useProviderListing(instance.data?.id, serverId);
  let provider = useProvider(instance.data?.id, providerId ?? undefined);

  if (providerId) {
    return (
      <SetupLayout
        main={{
          title: 'Redirecting...',
          description: 'Setting up your provider deployment.'
        }}
        backgroundUrl={bg}
      >
        <div />
      </SetupLayout>
    );
  }

  // Legacy server-based deployment flow (for magic-mcp or backwards compatibility)
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
