import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
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
import { PortalAuthGate, PortalManagementGate } from './pages/portal/shared';

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
  import('./pages/(logs)/provider-session/logs').then(c => c.ProviderSessionLogsPage)
);
let SessionTemplateLayout = dynamicPage(() =>
  import('./pages/(session)/session-template/_layout').then(c => c.SessionTemplateLayout)
);
let SessionTemplateOverviewPage = dynamicPage(() =>
  import('./pages/(session)/session-template/index').then(c => c.SessionTemplateOverviewPage)
);
let SessionTemplateProvidersPage = dynamicPage(() =>
  import('./pages/(session)/session-template/providers').then(
    c => c.SessionTemplateProvidersPage
  )
);
let SessionTemplateSettingsPage = dynamicPage(() =>
  import('./pages/(session)/session-template/settings').then(
    c => c.SessionTemplateSettingsPage
  )
);

let IdentityListLayout = dynamicPage(() =>
  import('./pages/(identity)/(list)/_layout').then(c => c.IdentityListLayout)
);
let ConsumersPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/consumers').then(c => c.ConsumersPage)
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
let ConsumerLayout = dynamicPage(() =>
  import('./pages/(identity)/consumer/_layout').then(c => c.ConsumerLayout)
);
let ConsumerPage = dynamicPage(() =>
  import('./pages/(identity)/consumer').then(c => c.ConsumerPage)
);
let ConsumerSettingsPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/settings').then(c => c.ConsumerSettingsPage)
);
let IdentityActorPage = dynamicPage(() =>
  import('./pages/(identity)/actor').then(c => c.IdentityActorPage)
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
let LogsListLayout = dynamicPage(() =>
  import('./pages/(logs)/(list)/_layout').then(c => c.LogsListLayout)
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
let PortalsPage = dynamicPage(() => import('./pages/portals').then(c => c.PortalsPage));
let ProviderTemplatesPage = dynamicPage(() =>
  import('./pages/providerTemplates').then(c => c.ProviderTemplatesPage)
);
let PortalLayout = dynamicPage(() =>
  import('./pages/portal/_layout').then(c => c.PortalLayout)
);
let PortalOverviewPage = dynamicPage(() =>
  import('./pages/portal').then(c => c.PortalOverviewPage)
);
let PortalUsersPage = dynamicPage(() =>
  import('./pages/portal/users').then(c => c.PortalUsersPage)
);
let PortalUserPage = dynamicPage(() =>
  import('./pages/portal/user').then(c => c.PortalUserPage)
);
let PortalGroupsPage = dynamicPage(() =>
  import('./pages/portal/groups').then(c => c.PortalGroupsPage)
);
let PortalGroupLayout = dynamicPage(() =>
  import('./pages/portal/group/_layout').then(c => c.PortalGroupLayout)
);
let PortalGroupOverviewPage = dynamicPage(() =>
  import('./pages/portal/group').then(c => c.PortalGroupOverviewPage)
);
let PortalGroupSettingsPage = dynamicPage(() =>
  import('./pages/portal/group/settings').then(c => c.PortalGroupSettingsPage)
);
let PortalServerRequestsPage = dynamicPage(() =>
  import('./pages/portal/serverRequests').then(c => c.PortalServerRequestsPage)
);
let PortalSettingsLayout = dynamicPage(() =>
  import('./pages/portal/settings/_layout').then(c => c.PortalSettingsLayout)
);
let PortalSettingsOverviewPage = dynamicPage(() =>
  import('./pages/portal/settings').then(c => c.PortalSettingsOverviewPage)
);
let PortalSettingsAuthPage = dynamicPage(() =>
  import('./pages/portal/settings/auth').then(c => c.PortalSettingsAuthPage)
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

  return (
    <PaginationSearchParamsProvider enabled={true}>
      <Outlet />
    </PaginationSearchParamsProvider>
  );
};

export let productInnerSlice = createSlice([
  {
    path: ':organizationId/:projectId/:instanceId',

    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: '',
            element: <ProjectHomePage />
          },

          /***************
           * Logs
           *************** */
          {
            children: [
              {
                path: '',
                element: <LogsListLayout />,

                children: [
                  {
                    path: 'sessions',
                    element: <SessionsPage />
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
              }
            ]
          },

          /***************
           * Provider API (Magnetar)
           *************** */
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
                path: 'providers',
                element: <SessionTemplateProvidersPage />
              },
              {
                path: 'settings',
                element: <SessionTemplateSettingsPage />
              }
            ]
          },

          {
            element: <IdentityListLayout />,
            children: [
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
            children: [
              {
                path: 'consumers',
                element: <ConsumersPage />
              },
              {
                path: 'actors',
                element: <IdentityActorsPage />
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
                path: 'settings',
                element: <ConsumerSettingsPage />
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
          },

          /***************
           * Magic MCP
           *************** */
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

          /***************
           * Explorer
           *************** */
          {
            path: 'explorer',
            element: <ExplorerPage />
          },

          {
            path: 'portals',
            element: (
              <PortalManagementGate>
                <PortalsPage />
              </PortalManagementGate>
            )
          },
          {
            path: 'provider-templates',
            element: (
              <PortalManagementGate>
                <ProviderTemplatesPage />
              </PortalManagementGate>
            )
          },
          {
            path: 'portal/:portalId',
            element: (
              <PortalManagementGate>
                <PortalLayout />
              </PortalManagementGate>
            ),
            children: [
              {
                path: '',
                element: <PortalOverviewPage />
              },
              {
                path: 'users',
                element: <PortalUsersPage />
              },
              {
                path: 'user/:userId',
                element: <PortalUserPage />
              },
              {
                path: 'groups',
                element: <PortalGroupsPage />
              },
              {
                path: 'group/:groupId',
                element: <PortalGroupLayout />,
                children: [
                  {
                    path: '',
                    element: <PortalGroupOverviewPage />
                  },
                  {
                    path: 'settings',
                    element: <PortalGroupSettingsPage />
                  }
                ]
              },
              {
                path: 'server-requests',
                element: <PortalServerRequestsPage />
              },
              {
                path: 'settings',
                element: <PortalSettingsLayout />,
                children: [
                  {
                    path: '',
                    element: <PortalSettingsOverviewPage />
                  },
                  {
                    path: 'authentication',
                    element: (
                      <PortalAuthGate>
                        <PortalSettingsAuthPage />
                      </PortalAuthGate>
                    )
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
          }
        ]
      },

      /***************
       * Servers
       *************** */
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
    element: <ProjectPageLayout />,
    children: productInnerSlice.routes
  },
  {
    children: deploySlice.routes
  }
]);
