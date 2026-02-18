import { Paths } from '@metorial/frontend-config';
import { SetupLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useProvider,
  useProviderListing
} from '@metorial/state';
import { Text } from '@metorial/ui';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import bg from '../../../assets/bg.webp';

export let DeployPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let [search] = useSearchParams();
  let serverId = search.get('server_id');
  let providerId = search.get('provider_id');
  let nextUrl = search.get('next_url');

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

  return (
    <SetupLayout
      main={
        serverListing.data
          ? {
              title: `Deploy ${serverListing.data.name}`,
              description: `Let's set up your MCP server.`
            }
          : undefined
      }
      backgroundUrl={bg}
    >
      {serverId && (
        <Text size="2" color="gray600">
          Server deployment forms have been moved to the provider API.
        </Text>
      )}
    </SetupLayout>
  );
};
