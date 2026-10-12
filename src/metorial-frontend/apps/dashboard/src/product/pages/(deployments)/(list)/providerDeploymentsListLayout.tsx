import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { Button } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import {
  showCreateProviderAuthConfigFlow,
  showCreateProviderConfigFlow
} from '../../../scenes/providerCreationFlows';

type ConfigurationsTabId = 'auth-configs' | 'configs';

let getActiveTab = (pathname: string): ConfigurationsTabId => {
  if (pathname.endsWith('/configs')) return 'configs';
  return 'auth-configs';
};

let configurationsTabs: Record<
  ConfigurationsTabId,
  {
    label: string;
    segment?: 'configs' | 'auth-configs';
    description: string;
    actionLabel: string;
    onAction: (instanceId: string) => void;
  }
> = {
  configs: {
    label: 'Provider Configs',
    segment: 'configs',
    description: 'Manage provider configuration profiles across your providers.',
    actionLabel: 'Create Config',
    onAction: instanceId => showCreateProviderConfigFlow(instanceId)
  },
  'auth-configs': {
    label: 'Auth Configs',
    segment: 'auth-configs',
    description: 'Manage authenticated connections to your providers.',
    actionLabel: 'Create Auth Config',
    onAction: instanceId =>
      showCreateProviderAuthConfigFlow(instanceId, {
        scope: 'provider'
      })
  }
};

export let ProviderDeploymentsListLayout = () => {
  let instance = useCurrentInstance();
  let location = useLocation();
  let pathname = location.pathname;
  let activeTab = getActiveTab(pathname);
  let currentTab = configurationsTabs[activeTab];

  return (
    <ContentLayout>
      <PageHeader
        title={currentTab.label}
        description={currentTab.description}
        actions={
          <Button
            size="2"
            onClick={() => {
              if (instance.data?.id) currentTab.onAction(instance.data.id);
            }}
          >
            {currentTab.actionLabel}
          </Button>
        }
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};

export let ProviderAuthCredentialsListLayout = () => {
  let instance = useCurrentInstance();

  return (
    <ContentLayout>
      <PageHeader
        title="Auth Credentials"
        description="Manage authentication credentials across your providers."
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};
