import { Paths } from '@metorial/frontend-config';
import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import {
  showCreateProviderAuthConfigFlow,
  showCreateProviderConfigFlow
} from '../../../scenes/providerCreationFlows';

type ConfigurationsTabId = 'auth-configs' | 'configs';

let configurationsTabOrder: ConfigurationsTabId[] = ['auth-configs', 'configs'];

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
    label: 'Configs',
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
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let location = useLocation();
  let pathname = location.pathname;
  let search = location.search;
  let activeTab = getActiveTab(pathname);
  let currentTab = configurationsTabs[activeTab];
  let pathParams = [organization.data, project.data, instance.data] as const;

  return (
    <ContentLayout>
      <PageHeader
        title="Configurations"
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

      <LinkTabs
        current={pathname}
        links={configurationsTabOrder.map(tabId => {
          let tab = configurationsTabs[tabId];

          return {
            label: tab.label,
            to: `${
              tab.segment === 'configs'
                ? Paths.instance.providerConfigs(...pathParams)
                : Paths.instance.providerAuthConfigs(...pathParams)
            }${search}`
          };
        })}
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
