import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { showProviderDeploymentFormModal } from '../../../scenes/providerDeployments/modal';
import {
  showCreateProviderAuthConfigFlow,
  showCreateProviderAuthCredentialsFlow,
  showCreateProviderConfigFlow,
  showCreateProviderConfigVaultFlow
} from './providerCreationFlows';

type ProviderDeploymentsTabId =
  | 'deployments'
  | 'configs'
  | 'config-vaults'
  | 'auth-credentials'
  | 'auth-configs';

let providerConfigurationsTabOrder: Exclude<ProviderDeploymentsTabId, 'deployments'>[] = [
  'auth-configs',
  'auth-credentials',
  'configs',
  'config-vaults'
];

let getActiveTab = (pathname: string): ProviderDeploymentsTabId => {
  if (pathname.endsWith('/auth-credentials')) return 'auth-credentials';
  if (pathname.endsWith('/auth-configs')) return 'auth-configs';
  if (pathname.endsWith('/config-vaults')) return 'config-vaults';
  if (pathname.endsWith('/configs')) return 'configs';
  return 'deployments';
};

let providerDeploymentsTabs: Record<
  ProviderDeploymentsTabId,
  {
    label: string;
    segment?: 'configs' | 'config-vaults' | 'auth-credentials' | 'auth-configs';
    description: string;
    renderAction: (d: {
      instance: ReturnType<typeof useCurrentInstance>['data'];
      organization: ReturnType<typeof useCurrentOrganization>['data'];
      project: ReturnType<typeof useCurrentProject>['data'];
      navigate: ReturnType<typeof useNavigate>;
    }) => ReactNode;
  }
> = {
  deployments: {
    label: 'Deployments',
    description: 'Manage your provider deployments, configs, and authentication.',
    renderAction: ({ instance, organization, project, navigate }) => (
      <Button
        size="2"
        onClick={() =>
          showProviderDeploymentFormModal({
            type: 'create',
            instanceId: instance?.id,
            onCreate: deployment => {
              if (!instance) return;

              navigate(
                Paths.instance.providerDeployment(
                  organization,
                  project,
                  instance,
                  deployment.id
                )
              );
            }
          })
        }
      >
        Create Deployment
      </Button>
    )
  },
  configs: {
    label: 'Configs',
    segment: 'configs',
    description: 'Manage provider configuration profiles across your providers.',
    renderAction: ({ instance }) => (
      <Button
        size="2"
        onClick={() => {
          if (instance?.id) {
            showCreateProviderConfigFlow(instance.id);
          }
        }}
      >
        Create Config
      </Button>
    )
  },
  'config-vaults': {
    label: 'Vaults',
    segment: 'config-vaults',
    description: 'Manage reusable configuration vaults across your providers.',
    renderAction: ({ instance }) => (
      <Button
        size="2"
        onClick={() => {
          if (instance?.id) {
            showCreateProviderConfigVaultFlow(instance.id);
          }
        }}
      >
        Create Config Vault
      </Button>
    )
  },
  'auth-credentials': {
    label: 'Auth Credentials',
    segment: 'auth-credentials',
    description: 'Manage authentication credentials across your providers.',
    renderAction: ({ instance }) => (
      <Button
        size="2"
        onClick={() => {
          if (instance?.id) {
            showCreateProviderAuthCredentialsFlow(instance.id);
          }
        }}
      >
        Create Auth Credentials
      </Button>
    )
  },
  'auth-configs': {
    label: 'Auth Configs',
    segment: 'auth-configs',
    description: 'Manage authenticated connections to your providers.',
    renderAction: ({ instance, organization, project, navigate }) => (
      <Button
        size="2"
        onClick={() => {
          if (instance?.id) {
            showCreateProviderAuthConfigFlow(instance.id, {
              scope: 'provider',
              onCreated: (deploymentId, authConfigId) => {
                if (!instance || !deploymentId) return;

                navigate(
                  Paths.instance.providerAuthConfig(
                    organization,
                    project,
                    instance,
                    deploymentId,
                    authConfigId
                  )
                );
              }
            });
          }
        }}
      >
        Create Auth Config
      </Button>
    )
  }
};

export let ProviderDeploymentsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let location = useLocation();
  let pathname = location.pathname;
  let search = location.search;
  let navigate = useNavigate();

  let activeTab = getActiveTab(pathname);
  let currentTab = providerDeploymentsTabs[activeTab];
  let pathParams = [organization.data, project.data, instance.data] as const;
  let isDeploymentsPage = activeTab === 'deployments';

  return (
    <ContentLayout>
      <PageHeader
        title={isDeploymentsPage ? 'Deployments' : 'Configuration'}
        description={currentTab.description}
        actions={currentTab.renderAction({
          instance: instance.data,
          organization: organization.data,
          project: project.data,
          navigate
        })}
      />

      {!isDeploymentsPage && (
        <LinkTabs
          current={pathname}
          links={providerConfigurationsTabOrder.map(tabId => {
            let tab = providerDeploymentsTabs[tabId];

            return {
              label: tab.label,
              to: `${Paths.instance.providerDeployments(...pathParams, tab.segment)}${search}`
            };
          })}
        />
      )}

      <Outlet />
    </ContentLayout>
  );
};
