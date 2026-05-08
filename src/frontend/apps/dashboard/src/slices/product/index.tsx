import { renderWithLoader } from '@metorial/data-hooks';
import { dynamicPage } from '@metorial/dynamic-component';
import { createSlice } from '@metorial/microfrontend';
import { NotFound } from '@metorial/pages';
import { lastInstanceIdStore, useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { Error } from '@metorial/ui';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Upgrade } from '../../components/emptyState';
import { ProjectHomePage } from './pages';
import { InstanceLayout } from './pages/_instanceLayout';

// Provider API pages
let ProvidersHubLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.ProvidersHubLayout)
);
let ProvidersPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/providers').then(c => c.ProvidersPage)
);
let ProviderDeploymentsListLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.ProviderDeploymentsListLayout)
);
let ProviderDeploymentsPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-deployments').then(
    c => c.ProviderDeploymentsPage
  )
);
let ProviderAuthConfigsOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-auth-configs').then(
    c => c.ProviderAuthConfigsOverviewPage
  )
);
let ProviderAuthCredentialsOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-auth-credentials').then(
    c => c.ProviderAuthCredentialsOverviewPage
  )
);
let ProviderConfigsOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-configs').then(
    c => c.ProviderConfigsOverviewPage
  )
);
let ProviderConfigVaultsOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-config-vaults').then(
    c => c.ProviderConfigVaultsOverviewPage
  )
);
let ProviderSessionsListLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.ProviderSessionsListLayout)
);
let ProviderSessionsPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-sessions').then(c => c.ProviderSessionsPage)
);
let SessionTemplatesListLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.SessionTemplatesListLayout)
);
let SessionTemplatesPage = dynamicPage(() =>
  import('./pages/(session)/(list)/session-templates').then(c => c.SessionTemplatesPage)
);
let ProviderLayout = dynamicPage(() =>
  import('./pages/provider/_layout').then(c => c.ProviderLayout)
);
let ProviderOverviewPage = dynamicPage(() =>
  import('./pages/provider/index').then(c => c.ProviderOverviewPage)
);
let ProviderVersionsPage = dynamicPage(() =>
  import('./pages/provider/versions').then(c => c.ProviderVersionsPage)
);
let ProviderToolsPage = dynamicPage(() =>
  import('./pages/provider/tools').then(c => c.ProviderToolsPage)
);
let ProviderTriggersPage = dynamicPage(() =>
  import('./pages/provider/triggers').then(c => c.ProviderTriggersPage)
);
let ProviderDetailsDeploymentsPage = dynamicPage(() =>
  import('./pages/provider/deployments').then(c => c.ProviderDeploymentsPage)
);
let ProviderAuthMethodsPage = dynamicPage(() =>
  import('./pages/provider/auth-methods').then(c => c.ProviderAuthMethodsPage)
);
let ProviderReadmePage = dynamicPage(() =>
  import('./pages/provider/readme').then(c => c.ProviderReadmePage)
);
let ProviderDeploymentLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/_layout').then(
    c => c.ProviderDeploymentLayout
  )
);
let ProviderDeploymentOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/index').then(
    c => c.ProviderDeploymentOverviewPage
  )
);
let ProviderDeploymentConfigsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/configs').then(
    c => c.ProviderDeploymentConfigsPage
  )
);
let ProviderDeploymentConfigVaultsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/config-vaults').then(
    c => c.ProviderDeploymentConfigVaultsPage
  )
);
let ProviderDeploymentAuthMethodsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/auth-methods').then(
    c => c.ProviderDeploymentAuthMethodsPage
  )
);
let ProviderDeploymentAuthConfigsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/auth-configs').then(
    c => c.ProviderDeploymentAuthConfigsPage
  )
);
let ProviderDeploymentAuthCredentialsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/auth-credentials').then(
    c => c.ProviderDeploymentAuthCredentialsPage
  )
);
let ProviderDeploymentSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/settings').then(
    c => c.ProviderDeploymentSettingsPage
  )
);
let ProviderConfigLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-config/_layout').then(c => c.ProviderConfigLayout)
);
let ProviderConfigOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config/index').then(c => c.ProviderConfigOverviewPage)
);
let ProviderConfigSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config/settings').then(
    c => c.ProviderConfigSettingsPage
  )
);
let ProviderConfigVaultLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-config-vault/_layout').then(
    c => c.ProviderConfigVaultLayout
  )
);
let ProviderConfigVaultOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config-vault/index').then(
    c => c.ProviderConfigVaultOverviewPage
  )
);
let ProviderConfigVaultConfigsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config-vault/configs').then(
    c => c.ProviderConfigVaultConfigsPage
  )
);
let ProviderConfigVaultSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config-vault/settings').then(
    c => c.ProviderConfigVaultSettingsPage
  )
);
let ProviderAuthCredentialLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-credential/_layout').then(
    c => c.ProviderAuthCredentialLayout
  )
);
let ProviderAuthCredentialOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-credential/index').then(
    c => c.ProviderAuthCredentialOverviewPage
  )
);
let ProviderAuthCredentialAuthConfigsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-credential/auth-configs').then(
    c => c.ProviderAuthCredentialAuthConfigsPage
  )
);
let ProviderAuthCredentialSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-credential/settings').then(
    c => c.ProviderAuthCredentialSettingsPage
  )
);
let ProviderAuthConfigLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-configs/_layout').then(
    c => c.ProviderAuthConfigLayout
  )
);
let ProviderAuthConfigOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-configs/index').then(
    c => c.ProviderAuthConfigOverviewPage
  )
);
let ProviderAuthConfigSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-configs/settings').then(
    c => c.ProviderAuthConfigSettingsPage
  )
);
let ProviderSessionLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-session/_layout').then(c => c.ProviderSessionLayout)
);
let ProviderSessionProvidersPage = dynamicPage(() =>
  import('./pages/(logs)/provider-session/providers').then(c => c.ProviderSessionProvidersPage)
);
let ProviderSessionRunsPage = dynamicPage(() =>
  import('./pages/(logs)/provider-session/runs').then(c => c.ProviderSessionRunsPage)
);
let ProviderSessionLogsPage = dynamicPage(() =>
  import('./pages/(logs)/provider-session').then(c => c.ProviderSessionLogsPage)
);
let SessionTemplateLayout = dynamicPage(() =>
  import('./pages/(session)/session-template/_layout').then(c => c.SessionTemplateLayout)
);
let SessionTemplateOverviewPage = dynamicPage(() =>
  import('./pages/(session)/session-template/index').then(c => c.SessionTemplateOverviewPage)
);
let SessionTemplateSettingsPage = dynamicPage(() =>
  import('./pages/(session)/session-template/settings').then(
    c => c.SessionTemplateSettingsPage
  )
);

let IntegrationsListLayout = dynamicPage(() =>
  import('./pages/(integrations)/(list)/_layout').then(c => c.IntegrationsListLayout)
);
let IntegrationsPage = dynamicPage(() =>
  import('./pages/(integrations)/(list)/integrations').then(c => c.IntegrationsPage)
);
let IntegrationLayout = dynamicPage(() =>
  import('./pages/(integrations)/integration/_layout').then(c => c.IntegrationLayout)
);
let IntegrationOverviewPage = dynamicPage(() =>
  import('./pages/(integrations)/integration').then(c => c.IntegrationOverviewPage)
);
let IntegrationInstancesPage = dynamicPage(() =>
  import('./pages/(integrations)/integration/instances').then(c => c.IntegrationInstancesPage)
);
let IntegrationSettingsPage = dynamicPage(() =>
  import('./pages/(integrations)/integration/settings').then(c => c.IntegrationSettingsPage)
);
let IntegrationInstanceLayout = dynamicPage(() =>
  import('./pages/(integrations)/integration-instance/_layout').then(
    c => c.IntegrationInstanceLayout
  )
);
let IntegrationInstanceOverviewPage = dynamicPage(() =>
  import('./pages/(integrations)/integration-instance').then(
    c => c.IntegrationInstanceOverviewPage
  )
);
let IntegrationInstanceSettingsPage = dynamicPage(() =>
  import('./pages/(integrations)/integration-instance/settings').then(
    c => c.IntegrationInstanceSettingsPage
  )
);

let IdentityListLayout = dynamicPage(() =>
  import('./pages/(identity)/(list)/_layout').then(c => c.IdentityListLayout)
);
let AgentsListLayout = dynamicPage(() =>
  import('./pages/(identity)/(list)/_layout').then(c => c.AgentsListLayout)
);
let ConsumersPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/consumers').then(c => c.ConsumersPage)
);
let AgentsPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/agents').then(c => c.AgentsPage)
);
let IdentityActorsPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/actors').then(c => c.IdentityActorsPage)
);
let IdentitiesPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/identities').then(c => c.IdentitiesPage)
);
let IdentityDelegationsPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/delegations').then(c => c.IdentityDelegationsPage)
);
let IdentityDelegationConfigsPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/delegation-configs').then(
    c => c.IdentityDelegationConfigsPage
  )
);
let IdentityActorLayout = dynamicPage(() =>
  import('./pages/(identity)/actor/_layout').then(c => c.IdentityActorLayout)
);
let AgentLayout = dynamicPage(() =>
  import('./pages/(identity)/agent/_layout').then(c => c.AgentLayout)
);
let ConsumerLayout = dynamicPage(() =>
  import('./pages/(identity)/consumer/_layout').then(c => c.ConsumerLayout)
);
let ConsumerPage = dynamicPage(() =>
  import('./pages/(identity)/consumer').then(c => c.ConsumerPage)
);
let ConsumerOperationsPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/operations').then(c => c.ConsumerOperationsPage)
);
let ConsumerConnectionsPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/connections').then(c => c.ConsumerConnectionsPage)
);
let ConsumerDelegationsPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/delegations').then(c => c.ConsumerDelegationsPage)
);
let ConsumerSettingsPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/settings').then(c => c.ConsumerSettingsPage)
);
let ConsumerMagicMcpServersPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/magic-mcp-servers').then(
    c => c.ConsumerMagicMcpServersPage
  )
);
let IdentityActorPage = dynamicPage(() =>
  import('./pages/(identity)/actor').then(c => c.IdentityActorPage)
);
let IdentityActorOperationsPage = dynamicPage(() =>
  import('./pages/(identity)/actor/operations').then(c => c.IdentityActorOperationsPage)
);
let IdentityActorConnectionsPage = dynamicPage(() =>
  import('./pages/(identity)/actor/connections').then(c => c.IdentityActorConnectionsPage)
);
let IdentityActorDelegationsPage = dynamicPage(() =>
  import('./pages/(identity)/actor/delegations').then(c => c.IdentityActorDelegationsPage)
);
let AgentPage = dynamicPage(() => import('./pages/(identity)/agent').then(c => c.AgentPage));
let AgentOperationsPage = dynamicPage(() =>
  import('./pages/(identity)/agent/operations').then(c => c.AgentOperationsPage)
);
let AgentConnectionsPage = dynamicPage(() =>
  import('./pages/(identity)/agent/connections').then(c => c.AgentConnectionsPage)
);
let AgentDelegationsPage = dynamicPage(() =>
  import('./pages/(identity)/agent/delegations').then(c => c.AgentDelegationsPage)
);
let IdentityActorSettingsPage = dynamicPage(() =>
  import('./pages/(identity)/actor/settings').then(c => c.IdentityActorSettingsPage)
);
let IdentityLayout = dynamicPage(() =>
  import('./pages/(identity)/identity/_layout').then(c => c.IdentityLayout)
);
let IdentityPage = dynamicPage(() =>
  import('./pages/(identity)/identity').then(c => c.IdentityPage)
);
let IdentityDetailsDelegationsPage = dynamicPage(() =>
  import('./pages/(identity)/identity/delegations').then(c => c.IdentityDelegationsPage)
);
let IdentityDelegationRequestsPage = dynamicPage(() =>
  import('./pages/(identity)/identity/delegationRequests').then(
    c => c.IdentityDelegationRequestsPage
  )
);
let IdentitySettingsPage = dynamicPage(() =>
  import('./pages/(identity)/identity/settings').then(c => c.IdentitySettingsPage)
);
let IdentityDelegationLayout = dynamicPage(() =>
  import('./pages/(identity)/delegation/_layout').then(c => c.IdentityDelegationLayout)
);
let IdentityDelegationPage = dynamicPage(() =>
  import('./pages/(identity)/delegation').then(c => c.IdentityDelegationPage)
);
let IdentityDelegationConfigLayout = dynamicPage(() =>
  import('./pages/(identity)/delegation-config/_layout').then(
    c => c.IdentityDelegationConfigLayout
  )
);
let IdentityDelegationConfigPage = dynamicPage(() =>
  import('./pages/(identity)/delegation-config').then(c => c.IdentityDelegationConfigPage)
);

let SetupProviderPage = dynamicPage(() =>
  import('./pages/setup-provider').then(c => c.SetupProviderPage)
);

let MagicMcpListLayout = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/_layout').then(c => c.MagicMcpListLayout)
);
let MagicMcpServerPage = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/servers').then(c => c.MagicMcpServerPage)
);
let MagicMcpTokensPage = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/tokens').then(c => c.MagicMcpTokensPage)
);
let MagicMcpSessionsPage = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/sessions').then(c => c.MagicMcpSessionsPage)
);
let MagicMcpGroupsPage = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/groups').then(c => c.MagicMcpGroupsPage)
);
let MagicMcpServerLayout = dynamicPage(() =>
  import('./pages/magic-mcp/server/_layout').then(c => c.MagicMcpServerLayout)
);
let MagicMcpServerOverviewPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/overview').then(c => c.MagicMcpServerOverviewPage)
);
let MagicMcpServerProvidersPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/providers').then(c => c.MagicMcpServerProvidersPage)
);
let MagicMcpServerTokensPage = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/tokens').then(c => c.MagicMcpTokensPage)
);
let MagicMcpServerConfigPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/config').then(c => c.MagicMcpServerConfigPage)
);
let MagicMcpServerSessionsPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/sessions').then(c => c.MagicMcpServerSessionsPage)
);
let MagicMcpConnectionLayout = dynamicPage(() =>
  import('./pages/magic-mcp/connection/_layout').then(c => c.MagicMcpConnectionLayout)
);
let MagicMcpConnectionMessagesPage = dynamicPage(() =>
  import('./pages/magic-mcp/connection/messages').then(c => c.MagicMcpConnectionMessagesPage)
);
let MagicMcpConnectionProvidersPage = dynamicPage(() =>
  import('./pages/magic-mcp/connection/providers').then(c => c.MagicMcpConnectionProvidersPage)
);
let MagicMcpConnectionRunsPage = dynamicPage(() =>
  import('./pages/magic-mcp/connection/runs').then(c => c.MagicMcpConnectionRunsPage)
);
let MagicMcpGroupLayout = dynamicPage(() =>
  import('./pages/magic-mcp/group/_layout').then(c => c.MagicMcpGroupLayout)
);
let MagicMcpGroupOverviewPage = dynamicPage(() =>
  import('./pages/magic-mcp/group/overview').then(c => c.MagicMcpGroupOverviewPage)
);
let MagicMcpGroupSettingsPage = dynamicPage(() =>
  import('./pages/magic-mcp/group/settings').then(c => c.MagicMcpGroupSettingsPage)
);

let CustomProviderCodePage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/code').then(c => c.CustomProviderCodePage)
);
let CustomProviderOverviewPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider').then(c => c.CustomProviderOverviewPage)
);
let CustomProviderVersionsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/versions').then(
    c => c.CustomProviderVersionsPage
  )
);
let CustomProviderSettingsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/settings/settings').then(
    c => c.CustomProviderSettingsPage
  )
);
let CustomProviderLayout = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/_layout').then(
    c => c.CustomProviderLayout
  )
);
let CustomProviderCommitsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/commits').then(
    c => c.CustomProviderCommitsPage
  )
);
let CustomProviderDeploymentsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/deployments').then(
    c => c.CustomProviderProviderDeploymentsPage
  )
);
let CustomProviderListingPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/settings/listing').then(
    c => c.CustomProviderListingPage
  )
);
let ManagedServersListLayout = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/_layout').then(c => c.ManagedProvidersListLayout)
);
let ExternalServersListLayout = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/_layout').then(c => c.ExternalProvidersListLayout)
);
let ExternalServersPage = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/external-providers').then(
    c => c.ExternalProvidersPage
  )
);
let ManagedServersPage = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/custom-providers').then(
    c => c.CustomerProvidersPage
  )
);
let CallbacksListLayout = dynamicPage(() =>
  import('./pages/(callbacks)/(list)/_layout').then(c => c.CallbacksListLayout)
);
let CallbacksPage = dynamicPage(() =>
  import('./pages/(callbacks)/(list)/index').then(c => c.CallbacksPage)
);
let CallbackLayout = dynamicPage(() =>
  import('./pages/(callbacks)/_layout').then(c => c.CallbackLayout)
);
let CallbackOverviewPage = dynamicPage(() =>
  import('./pages/(callbacks)/overview').then(c => c.CallbackOverviewPage)
);
let CallbackEventsPage = dynamicPage(() =>
  import('./pages/(callbacks)/events').then(c => c.CallbackEventsPage)
);
let CallbackLogsPage = dynamicPage(() =>
  import('./pages/(callbacks)/logs').then(c => c.CallbackLogsPage)
);
let CallbackTriggersPage = dynamicPage(() =>
  import('./pages/(callbacks)/triggers').then(c => c.CallbackTriggersPage)
);
let CallbackDestinationsPage = dynamicPage(() =>
  import('./pages/(callbacks)/destinations').then(c => c.CallbackDestinationsPage)
);
let LogsHomePage = dynamicPage(() => import('./pages/(logs)/home').then(c => c.LogsHomePage));
let SessionLogsListLayout = dynamicPage(() =>
  import('./pages/(logs)/(list)/_layout').then(c => c.SessionLogsListLayout)
);
let AuthLogsListLayout = dynamicPage(() =>
  import('./pages/(logs)/(list)/_layout').then(c => c.AuthLogsListLayout)
);
let ServerErrorsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-errors').then(c => c.ProviderErrorsPage)
);
let ServerRunsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-runs').then(c => c.ProviderRunsPage)
);
let SessionsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/sessions').then(c => c.SessionsPage)
);
let SessionConnectionsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/connections').then(c => c.SessionConnectionsPage)
);
let ToolCallsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/tool-calls').then(c => c.ToolCallsPage)
);
let ServerErrorPage = dynamicPage(() =>
  import('./pages/(logs)/provider-error').then(c => c.ProviderErrorPage)
);
let ServerErrorLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-error/_layout').then(c => c.ProviderErrorLayout)
);
let ServerRunPage = dynamicPage(() =>
  import('./pages/(logs)/provider-run').then(c => c.ProviderRunPage)
);
let ServerRunLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-run/_layout').then(c => c.ProviderRunLayout)
);
let ProviderAuthErrorsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-auth-errors').then(c => c.ProviderAuthErrorsPage)
);
let ProviderAuthEventsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-auth-events').then(c => c.ProviderAuthEventsPage)
);
let ProviderAuthErrorPage = dynamicPage(() =>
  import('./pages/(logs)/provider-auth-error').then(c => c.ProviderAuthErrorPage)
);
let ProviderAuthErrorLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-auth-error/_layout').then(c => c.ProviderAuthErrorLayout)
);
let ProviderAuthEventPage = dynamicPage(() =>
  import('./pages/(logs)/provider-auth-event').then(c => c.ProviderAuthEventPage)
);
let ProviderAuthEventLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-auth-event/_layout').then(c => c.ProviderAuthEventLayout)
);
let ProjectPageLayout = dynamicPage(() =>
  import('./pages/_layout').then(c => c.ProjectPageLayout)
);
let DeployPage = dynamicPage(() =>
  import('./pages/setup-provider').then(c => c.SetupProviderPage)
);
let ProjectDeveloperPage = dynamicPage(() =>
  import('./pages/developer').then(c => c.ProjectDeveloperPage)
);
let ProjectDeveloperPageLayout = dynamicPage(() =>
  import('./pages/developer/_layout').then(c => c.ProjectDeveloperPageLayout)
);
let ProjectDeveloperAPIPage = dynamicPage(() =>
  import('./pages/developer/api').then(c => c.ProjectDeveloperAPIPage)
);
let ExplorerPage = dynamicPage(() => import('./pages/explorer').then(c => c.ExplorerPage));
let AssistantPage = dynamicPage(() => import('./pages/assistant').then(c => c.AssistantPage));
let AssistantConversationPage = dynamicPage(() =>
  import('./pages/assistant/conversation').then(c => c.AssistantConversationPage)
);
let FlaggedPage = ({ children, flag }: { children: React.ReactNode; flag: string }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) =>
    (flags.data.flags as any)[flag] ? children : <NotFound />
  );
};
let IdentityManagedPage = ({ children }: { children: React.ReactNode }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) => {
    if (!flags.data.flags['identity-management']) {
      return <Error>Identity management is not enabled for this instance.</Error>;
    }

    if (!flags.data.flags['paid-identity']) {
      return (
        <Upgrade
          title="Identity Management"
          description="Manage identity actors, identities, delegations, and delegation policies once this instance is upgraded."
        />
      );
    }

    return children;
  });
};
let ProductWrapper = () => {
  let instance = useCurrentInstance();

  useEffect(() => {
    if (!instance.data) return;
    lastInstanceIdStore.set(instance.data.id);
  }, [instance.data]);

  return <Outlet />;
};

export let productTraceSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'logs',
            element: <LogsHomePage />
          },

          {
            children: [
              {
                path: '',
                element: <SessionLogsListLayout />,

                children: [
                  {
                    path: 'sessions',
                    element: <SessionsPage />
                  },
                  {
                    path: 'session-connections',
                    element: <SessionConnectionsPage />
                  },
                  {
                    path: 'tool-calls',
                    element: <ToolCallsPage />
                  },
                  {
                    path: 'provider-runs',
                    element: <ServerRunsPage />
                  },
                  {
                    path: 'provider-errors',
                    element: <ServerErrorsPage />
                  }
                ]
              },
              {
                path: '',
                element: <AuthLogsListLayout />,

                children: [
                  {
                    path: 'provider-auth-events',
                    element: <ProviderAuthEventsPage />
                  },
                  {
                    path: 'provider-auth-errors',
                    element: <ProviderAuthErrorsPage />
                  }
                ]
              }
            ]
          },

          {
            path: 'provider-sessions',
            element: <ProviderSessionsListLayout />,
            children: [
              {
                path: '',
                element: <ProviderSessionsPage />
              }
            ]
          },
          {
            path: 'session-connections',
            element: <ProviderSessionsListLayout />,
            children: [
              {
                path: '',
                element: <SessionConnectionsPage />
              }
            ]
          },
          {
            path: 'tool-calls',
            element: <ProviderSessionsListLayout />,
            children: [
              {
                path: '',
                element: <ToolCallsPage />
              }
            ]
          },
          {
            path: 'provider-runs',
            element: <ProviderSessionsListLayout />,
            children: [
              {
                path: '',
                element: <ServerRunsPage />
              }
            ]
          },
          {
            path: 'provider-errors',
            element: <ProviderSessionsListLayout />,
            children: [
              {
                path: '',
                element: <ServerErrorsPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let productTraceDetailSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'provider-error/:providerErrorId',
            element: <ServerErrorLayout />,

            children: [
              {
                path: '',
                element: <ServerErrorPage />
              }
            ]
          },

          {
            path: 'provider-run/:providerRunId',
            element: <ServerRunLayout />,

            children: [
              {
                path: '',
                element: <ServerRunPage />
              }
            ]
          },

          {
            path: 'provider-auth-error/:providerAuthErrorId',
            element: <ProviderAuthErrorLayout />,

            children: [
              {
                path: '',
                element: <ProviderAuthErrorPage />
              }
            ]
          },

          {
            path: 'provider-auth-event/:providerAuthEventId',
            element: <ProviderAuthEventLayout />,

            children: [
              {
                path: '',
                element: <ProviderAuthEventPage />
              }
            ]
          },

          {
            path: 'provider-session/:sessionId',
            element: <ProviderSessionLayout />,
            children: [
              {
                path: '',
                element: <ProviderSessionLogsPage />
              },
              {
                path: 'providers',
                element: <ProviderSessionProvidersPage />
              },
              {
                path: 'runs',
                element: <ProviderSessionRunsPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let productExplorerSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'explorer',
            element: <ExplorerPage />
          }
        ]
      }
    ]
  }
]);

export let productIdentitySlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'agents',
            element: <AgentsListLayout />,
            children: [
              {
                path: '',
                element: <AgentsPage />
              }
            ]
          },
          {
            element: <IdentityListLayout />,
            children: [
              {
                path: 'actors',
                element: <IdentityActorsPage />
              },
              {
                path: 'identities',
                element: <IdentitiesPage />
              },

              {
                path: 'identity',
                children: [
                  {
                    path: 'delegations',
                    element: <IdentityDelegationsPage />
                  },
                  {
                    path: 'delegation-configs',
                    element: <IdentityDelegationConfigsPage />
                  }
                ]
              }
            ]
          },
          {
            path: 'consumers',
            element: <ConsumersPage />
          },

          {
            path: 'agent/:agentId',
            element: (
              <IdentityManagedPage>
                <AgentLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <AgentPage />
              },
              {
                path: 'operations',
                element: <AgentOperationsPage />
              },
              {
                path: 'connections',
                element: <AgentConnectionsPage />
              },
              {
                path: 'delegations',
                element: <AgentDelegationsPage />
              }
            ]
          },

          {
            path: 'consumer/:consumerId',
            element: (
              <IdentityManagedPage>
                <ConsumerLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <ConsumerPage />
              },
              {
                path: 'operations',
                element: <ConsumerOperationsPage />
              },
              {
                path: 'connections',
                element: <ConsumerConnectionsPage />
              },
              {
                path: 'delegations',
                element: <ConsumerDelegationsPage />
              },
              {
                path: 'settings',
                element: <ConsumerSettingsPage />
              },
              {
                path: 'magic-mcp-servers',
                element: <ConsumerMagicMcpServersPage />
              }
            ]
          },

          {
            path: 'actor/:identityActorId',
            element: (
              <IdentityManagedPage>
                <IdentityActorLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <IdentityActorPage />
              },
              {
                path: 'operations',
                element: <IdentityActorOperationsPage />
              },
              {
                path: 'connections',
                element: <IdentityActorConnectionsPage />
              },
              {
                path: 'delegations',
                element: <IdentityActorDelegationsPage />
              },
              {
                path: 'settings',
                element: <IdentityActorSettingsPage />
              }
            ]
          },

          {
            path: 'identity/:identityId',
            element: (
              <IdentityManagedPage>
                <IdentityLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <IdentityPage />
              },
              {
                path: 'delegations',
                element: <IdentityDetailsDelegationsPage />
              },
              {
                path: 'delegation-requests',
                element: <IdentityDelegationRequestsPage />
              },
              {
                path: 'settings',
                element: <IdentitySettingsPage />
              }
            ]
          },
          {
            path: 'identity/delegation/:identityDelegationId',
            element: (
              <IdentityManagedPage>
                <IdentityDelegationLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <IdentityDelegationPage />
              }
            ]
          },
          {
            path: 'identity/delegation-config/:identityDelegationConfigId',
            element: (
              <IdentityManagedPage>
                <IdentityDelegationConfigLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <IdentityDelegationConfigPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let productHomeSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: '',
            element: <ProjectHomePage />
          },

          {
            path: 'providers',
            element: <ProvidersHubLayout />,
            children: [
              {
                path: '',
                element: <ProvidersPage />
              }
            ]
          },

          {
            path: 'integrations',
            element: <IntegrationsListLayout />,
            children: [
              {
                path: '',
                element: <IntegrationsPage />
              }
            ]
          },

          {
            path: 'integration/:integrationId',
            element: <IntegrationLayout />,
            children: [
              {
                path: '',
                element: <IntegrationOverviewPage />
              },
              {
                path: 'instances',
                element: <IntegrationInstancesPage />
              },
              {
                path: 'settings',
                element: <IntegrationSettingsPage />
              }
            ]
          },

          {
            path: 'integration-instance/:integrationInstanceId',
            element: <IntegrationInstanceLayout />,
            children: [
              {
                path: '',
                element: <IntegrationInstanceOverviewPage />
              },
              {
                path: 'settings',
                element: <IntegrationInstanceSettingsPage />
              }
            ]
          },

          {
            path: 'configurations',
            element: <ProviderDeploymentsListLayout />,
            children: [
              {
                path: '',
                element: <ProviderDeploymentsPage />
              },
              {
                path: 'configs',
                element: <ProviderConfigsOverviewPage />
              },
              {
                path: 'config-vaults',
                element: <ProviderConfigVaultsOverviewPage />
              },
              {
                path: 'auth-credentials',
                element: <ProviderAuthCredentialsOverviewPage />
              },
              {
                path: 'auth-configs',
                element: <ProviderAuthConfigsOverviewPage />
              }
            ]
          },

          {
            path: 'provider/:providerId',
            element: <ProviderLayout />,
            children: [
              {
                path: '',
                element: <ProviderOverviewPage />
              },
              {
                path: 'readme',
                element: <ProviderReadmePage />
              },
              {
                path: 'tools',
                element: <ProviderToolsPage />
              },
              {
                path: 'triggers',
                element: <ProviderTriggersPage />
              },
              {
                path: 'deployments',
                element: <ProviderDetailsDeploymentsPage />
              },
              {
                path: 'auth-methods',
                element: <ProviderAuthMethodsPage />
              },
              {
                path: 'versions',
                element: <ProviderVersionsPage />
              }
            ]
          },

          {
            path: 'configurations/:providerDeploymentId',
            element: <ProviderDeploymentLayout />,
            children: [
              {
                path: '',
                element: <ProviderDeploymentOverviewPage />
              },
              {
                path: 'configs',
                element: <ProviderDeploymentConfigsPage />
              },
              {
                path: 'config-vaults',
                element: <ProviderDeploymentConfigVaultsPage />
              },
              {
                path: 'auth-methods',
                element: <ProviderDeploymentAuthMethodsPage />
              },
              {
                path: 'auth-configs',
                element: <ProviderDeploymentAuthConfigsPage />
              },
              {
                path: 'auth-credentials',
                element: <ProviderDeploymentAuthCredentialsPage />
              },
              {
                path: 'settings',
                element: <ProviderDeploymentSettingsPage />
              }
            ]
          },
          {
            path: 'provider-config-vault/:providerConfigVaultId',
            element: <ProviderConfigVaultLayout />,
            children: [
              {
                path: '',
                element: <ProviderConfigVaultOverviewPage />
              },
              {
                path: 'configs',
                element: <ProviderConfigVaultConfigsPage />
              },
              {
                path: 'settings',
                element: <ProviderConfigVaultSettingsPage />
              }
            ]
          },
          {
            path: 'configurations/config/:providerConfigId',
            element: <ProviderConfigLayout />,
            children: [
              {
                path: '',
                element: <ProviderConfigOverviewPage />
              },
              {
                path: 'settings',
                element: <ProviderConfigSettingsPage />
              }
            ]
          },
          {
            path: 'configurations/auth-credential/:providerAuthCredentialsId',
            element: <ProviderAuthCredentialLayout />,
            children: [
              {
                path: '',
                element: <ProviderAuthCredentialOverviewPage />
              },
              {
                path: 'auth-configs',
                element: <ProviderAuthCredentialAuthConfigsPage />
              },
              {
                path: 'settings',
                element: <ProviderAuthCredentialSettingsPage />
              }
            ]
          },
          {
            path: 'configurations/auth-config/:providerAuthConfigId',
            element: <ProviderAuthConfigLayout />,
            children: [
              {
                path: '',
                element: <ProviderAuthConfigOverviewPage />
              },
              {
                path: 'settings',
                element: <ProviderAuthConfigSettingsPage />
              }
            ]
          },

          {
            path: 'session-templates',
            element: <SessionTemplatesListLayout />,
            children: [
              {
                path: '',
                element: <SessionTemplatesPage />
              }
            ]
          },

          {
            path: 'session-template/:sessionTemplateId',
            element: <SessionTemplateLayout />,
            children: [
              {
                path: '',
                element: <SessionTemplateOverviewPage />
              },
              {
                path: 'settings',
                element: <SessionTemplateSettingsPage />
              }
            ]
          },

          {
            path: 'magic-mcp',
            children: [
              {
                element: (
                  <FlaggedPage flag="magic-mcp-enabled">
                    <MagicMcpListLayout />
                  </FlaggedPage>
                ),
                children: [
                  {
                    path: 'servers',
                    element: <MagicMcpServerPage />
                  },
                  {
                    path: 'tokens',
                    element: <MagicMcpTokensPage />
                  },
                  {
                    path: 'connections',
                    element: <MagicMcpSessionsPage />
                  },
                  {
                    path: 'groups',
                    element: <MagicMcpGroupsPage />
                  }
                ]
              },
              {
                path: 'connection/:connectionId',
                element: (
                  <FlaggedPage flag="magic-mcp-enabled">
                    <MagicMcpConnectionLayout />
                  </FlaggedPage>
                ),
                children: [
                  {
                    path: '',
                    element: <MagicMcpConnectionMessagesPage />
                  },
                  {
                    path: 'providers',
                    element: <MagicMcpConnectionProvidersPage />
                  },
                  {
                    path: 'runs',
                    element: <MagicMcpConnectionRunsPage />
                  }
                ]
              },
              {
                path: 'server/:magicMcpServerId',
                element: (
                  <FlaggedPage flag="magic-mcp-enabled">
                    <MagicMcpServerLayout />
                  </FlaggedPage>
                ),
                children: [
                  {
                    path: '',
                    element: <MagicMcpServerOverviewPage />
                  },
                  {
                    path: 'providers',
                    element: <MagicMcpServerProvidersPage />
                  },
                  {
                    path: 'tokens',
                    element: <MagicMcpServerTokensPage />
                  },
                  {
                    path: 'config',
                    element: <MagicMcpServerConfigPage />
                  },
                  {
                    path: 'connections',
                    element: <MagicMcpServerSessionsPage />
                  }
                ]
              },
              {
                path: 'group/:magicMcpGroupId',
                element: (
                  <FlaggedPage flag="magic-mcp-enabled">
                    <MagicMcpGroupLayout />
                  </FlaggedPage>
                ),
                children: [
                  {
                    path: '',
                    element: <MagicMcpGroupOverviewPage />
                  },
                  {
                    path: 'settings',
                    element: <MagicMcpGroupSettingsPage />
                  }
                ]
              }
            ]
          },

          {
            path: 'callback/:callbackId',
            element: <CallbackLayout />,
            children: [
              {
                path: '',
                element: <CallbackOverviewPage />
              },
              {
                path: 'events',
                element: <CallbackEventsPage />
              },
              {
                path: 'logs',
                element: <CallbackLogsPage />
              },
              {
                path: 'triggers',
                element: <CallbackTriggersPage />
              },
              {
                path: 'destinations',
                element: <CallbackDestinationsPage />
              }
            ]
          },

          {
            path: 'callbacks',
            element: <CallbacksListLayout />,
            children: [
              {
                path: '',
                element: <CallbacksPage />
              }
            ]
          },

          {
            path: 'developer',
            element: <ProjectDeveloperPageLayout />,

            children: [
              {
                path: '',
                element: <ProjectDeveloperPage />
              },
              {
                path: 'api',
                element: <ProjectDeveloperAPIPage />
              }
            ]
          },
          {
            path: 'assistant',
            children: [
              {
                path: '',
                element: <AssistantPage />
              },
              {
                path: 'conversation/:assistantConversationId',
                element: <AssistantConversationPage />
              }
            ]
          }
        ]
      },

      {
        children: [
          {
            path: '',
            element: <ManagedServersListLayout />,

            children: [
              {
                path: 'custom-providers',
                element: <ManagedServersPage />
              }
            ]
          },

          {
            path: '',
            element: <ExternalServersListLayout />,

            children: [
              {
                path: 'external-providers',
                element: <ExternalServersPage />
              }
            ]
          },

          {
            path: 'custom-provider/:customProviderId',
            element: <CustomProviderLayout />,

            children: [
              {
                path: '',
                element: <CustomProviderOverviewPage />
              },
              {
                path: 'versions',
                element: <CustomProviderVersionsPage />
              },
              {
                path: 'code',
                element: <CustomProviderCodePage />
              },
              {
                path: 'commits',
                element: <CustomProviderCommitsPage />
              },
              {
                path: 'deployments',
                element: <CustomProviderDeploymentsPage />
              },
              {
                path: 'settings',
                element: <CustomProviderSettingsPage />
              },
              {
                path: 'listing',
                element: <CustomProviderListingPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let deploySlice = createSlice([
  {
    path: ':organizationId/:projectId/:instanceId/deploy',
    element: <DeployPage />
  },
  {
    path: ':organizationId/:projectId/:instanceId/setup-provider',
    element: <SetupProviderPage />
  }
]);

export let productSlice = createSlice([
  {
    path: ':organizationId/:projectId/:instanceId',

    element: <ProjectPageLayout />,

    children: [
      ...productTraceSlice.routes,
      ...productTraceDetailSlice.routes,
      ...productExplorerSlice.routes,
      ...productIdentitySlice.routes,
      ...productHomeSlice.routes
    ]
  },
  {
    children: deploySlice.routes
  }
]);
