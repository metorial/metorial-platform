import { renderWithLoader } from '@metorial/data-hooks';
import { dynamicPage } from '@metorial/dynamic-component';
import { createSlice } from '@metorial/microfrontend';
import { NotFound } from '@metorial/pages';
import { lastInstanceIdStore, useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { ProjectHomePage } from './pages';
import { InstanceLayout } from './pages/_instanceLayout';

// Provider API pages
let ProvidersHubLayout = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/_layout').then(c => c.ProvidersHubLayout)
);
let ProvidersPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/providers').then(c => c.ProvidersPage)
);
let ProviderDeploymentsListLayout = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/_layout').then(c => c.ProviderDeploymentsListLayout)
);
let ProviderDeploymentsPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-deployments').then(
    c => c.ProviderDeploymentsPage
  )
);
let ProviderAuthConfigsOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-auth-configs').then(
    c => c.ProviderAuthConfigsOverviewPage
  )
);
let ProviderAuthCredentialsOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-auth-credentials').then(
    c => c.ProviderAuthCredentialsOverviewPage
  )
);
let ProviderConfigsOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-configs').then(
    c => c.ProviderConfigsOverviewPage
  )
);
let ProviderConfigVaultsOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-config-vaults').then(
    c => c.ProviderConfigVaultsOverviewPage
  )
);
let ProviderSessionsListLayout = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/_layout').then(c => c.ProviderSessionsListLayout)
);
let ProviderSessionsPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-sessions').then(c => c.ProviderSessionsPage)
);
let SessionTemplatesListLayout = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/_layout').then(c => c.SessionTemplatesListLayout)
);
let SessionTemplatesPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/session-templates').then(c => c.SessionTemplatesPage)
);
let ProviderDeploymentsRedirectPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/redirects').then(
    c => c.ProviderDeploymentsRedirectPage
  )
);
let SessionTemplatesRedirectPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/redirects').then(c => c.SessionTemplatesRedirectPage)
);
let ProviderLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider/_layout').then(c => c.ProviderLayout)
);
let ProviderOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/index').then(c => c.ProviderOverviewPage)
);
let ProviderVersionsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/versions').then(c => c.ProviderVersionsPage)
);
let ProviderToolsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/tools').then(c => c.ProviderToolsPage)
);
let ProviderDetailsDeploymentsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/deployments').then(c => c.ProviderDeploymentsPage)
);
let ProviderAuthMethodsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/auth-methods').then(c => c.ProviderAuthMethodsPage)
);
let ProviderReadmePage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/readme').then(c => c.ProviderReadmePage)
);
let ProviderDeploymentLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/_layout').then(
    c => c.ProviderDeploymentLayout
  )
);
let ProviderDeploymentOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/index').then(
    c => c.ProviderDeploymentOverviewPage
  )
);
let ProviderDeploymentConfigsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/configs').then(
    c => c.ProviderDeploymentConfigsPage
  )
);
let ProviderDeploymentConfigVaultsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/config-vaults').then(
    c => c.ProviderDeploymentConfigVaultsPage
  )
);
let ProviderDeploymentAuthMethodsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/auth-methods').then(
    c => c.ProviderDeploymentAuthMethodsPage
  )
);
let ProviderDeploymentAuthConfigsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/auth-configs').then(
    c => c.ProviderDeploymentAuthConfigsPage
  )
);
let ProviderDeploymentSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/settings').then(
    c => c.ProviderDeploymentSettingsPage
  )
);
let ProviderConfigLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config/_layout').then(c => c.ProviderConfigLayout)
);
let ProviderConfigOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config/index').then(
    c => c.ProviderConfigOverviewPage
  )
);
let ProviderConfigSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config/settings').then(
    c => c.ProviderConfigSettingsPage
  )
);
let ProviderConfigVaultLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config-vault/_layout').then(
    c => c.ProviderConfigVaultLayout
  )
);
let ProviderConfigVaultOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config-vault/index').then(
    c => c.ProviderConfigVaultOverviewPage
  )
);
let ProviderConfigVaultSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config-vault/settings').then(
    c => c.ProviderConfigVaultSettingsPage
  )
);
let ProviderAuthCredentialLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-credential/_layout').then(
    c => c.ProviderAuthCredentialLayout
  )
);
let ProviderAuthCredentialOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-credential/index').then(
    c => c.ProviderAuthCredentialOverviewPage
  )
);
let ProviderAuthCredentialSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-credential/settings').then(
    c => c.ProviderAuthCredentialSettingsPage
  )
);
let ProviderAuthConnectionLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-configs/_layout').then(
    c => c.ProviderAuthConfigLayout
  )
);
let ProviderAuthConnectionOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-configs/index').then(
    c => c.ProviderAuthConfigOverviewPage
  )
);
let ProviderAuthConnectionAuthenticationPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-configs/authentication').then(
    c => c.ProviderAuthConfigAuthenticationPage
  )
);
let ProviderAuthConnectionSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-configs/settings').then(
    c => c.ProviderAuthConfigSettingsPage
  )
);
let ProviderSessionLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/_layout').then(c => c.ProviderSessionLayout)
);
let ProviderSessionProvidersPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/providers').then(
    c => c.ProviderSessionProvidersPage
  )
);
let ProviderSessionRunsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/runs').then(c => c.ProviderSessionRunsPage)
);
let ProviderSessionLogsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/logs').then(c => c.ProviderSessionLogsPage)
);
let SessionTemplateLayout = dynamicPage(() =>
  import('./pages/(provider-api)/session-template/_layout').then(c => c.SessionTemplateLayout)
);
let SessionTemplateOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/session-template/index').then(
    c => c.SessionTemplateOverviewPage
  )
);
let SessionTemplateProvidersPage = dynamicPage(() =>
  import('./pages/(provider-api)/session-template/providers').then(
    c => c.SessionTemplateProvidersPage
  )
);
let SessionTemplateSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/session-template/settings').then(
    c => c.SessionTemplateSettingsPage
  )
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
let MagicMcpGroupLayout = dynamicPage(() =>
  import('./pages/magic-mcp/group/_layout').then(c => c.MagicMcpGroupLayout)
);
let MagicMcpGroupOverviewPage = dynamicPage(() =>
  import('./pages/magic-mcp/group/overview').then(c => c.MagicMcpGroupOverviewPage)
);
let MagicMcpGroupSettingsPage = dynamicPage(() =>
  import('./pages/magic-mcp/group/settings').then(c => c.MagicMcpGroupSettingsPage)
);

let CustomServerCodePage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/code').then(c => c.CustomProviderCodePage)
);
let CustomServerOverviewPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider').then(c => c.CustomProviderOverviewPage)
);
let CustomServerVersionsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/versions').then(
    c => c.CustomProviderVersionsPage
  )
);
let CustomServerSettingsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/settings/settings').then(
    c => c.CustomProviderSettingsPage
  )
);
let CustomServerLayout = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-server/_layout').then(c => c.CustomProviderLayout)
);
let CustomServerCommitsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/deployments').then(
    c => c.CustomProviderCommitsPage
  )
);
let CustomServerDeploymentsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/provider-deployments').then(
    c => c.CustomProviderProviderDeploymentsPage
  )
);
let CustomServerListingPage = dynamicPage(() =>
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
let SessionPage = dynamicPage(() => import('./pages/(logs)/session').then(c => c.SessionPage));
let SessionLayout = dynamicPage(() =>
  import('./pages/(logs)/session/_layout').then(c => c.SessionLayout)
);
let SessionDeploymentsPage = dynamicPage(() =>
  import('./pages/(logs)/session/deployments').then(c => c.SessionDeploymentsPage)
);
let SessionServerRunsPage = dynamicPage(() =>
  import('./pages/(logs)/session/serverRuns').then(c => c.ProviderRunsPage)
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
let NotFoundPage = dynamicPage(() => import('@metorial/pages').then(c => c.NotFound));
let FlaggedPage = ({ children, flag }: { children: React.ReactNode; flag: string }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) =>
    (flags.data.flags as any)[flag] ? children : <NotFound />
  );
};
let ProductWrapper = () => {
  let instance = useCurrentInstance();

  useEffect(() => {
    if (!instance.data) return;
    lastInstanceIdStore.set(instance.data.id);
  }, [instance.data]);

  return <Outlet />;
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
                    path: 'server-runs',
                    element: <ServerRunsPage />
                  },
                  {
                    path: 'provider-runs',
                    element: <ServerRunsPage />
                  },
                  {
                    path: 'server-errors',
                    element: <ServerErrorsPage />
                  },
                  {
                    path: 'provider-errors',
                    element: <ServerErrorsPage />
                  }
                ]
              },

              {
                path: 'server-error/:serverErrorId',
                element: <ServerErrorLayout />,

                children: [
                  {
                    path: '',
                    element: <ServerErrorPage />
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
                path: 'server-run/:serverRunId',
                element: <ServerRunLayout />,

                children: [
                  {
                    path: '',
                    element: <ServerRunPage />
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
                path: 'session/:sessionId',
                element: <SessionLayout />,

                children: [
                  {
                    path: '',
                    element: <SessionPage />
                  },
                  {
                    path: 'deployments',
                    element: <SessionDeploymentsPage />
                  },
                  {
                    path: 'runs',
                    element: <SessionServerRunsPage />
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
                path: 'settings',
                element: <ProviderConfigVaultSettingsPage />
              }
            ]
          },
          {
            path: 'configurations/:providerDeploymentId/config/:providerConfigId',
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
            path: 'configurations/:providerDeploymentId/auth-credential/:providerAuthCredentialsId',
            element: <ProviderAuthCredentialLayout />,
            children: [
              {
                path: '',
                element: <ProviderAuthCredentialOverviewPage />
              },
              {
                path: 'settings',
                element: <ProviderAuthCredentialSettingsPage />
              }
            ]
          },
          {
            path: 'configurations/:providerDeploymentId/auth-connection/:providerAuthConfigId',
            element: <ProviderAuthConnectionLayout />,
            children: [
              {
                path: '',
                element: <ProviderAuthConnectionOverviewPage />
              },
              {
                path: 'settings',
                element: <ProviderAuthConnectionSettingsPage />
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
                    path: 'sessions',
                    element: <MagicMcpSessionsPage />
                  },
                  {
                    path: 'groups',
                    element: <MagicMcpGroupsPage />
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
                    path: 'sessions',
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
            element: (
              <FlaggedPage flag="metorial-gateway-enabled">
                <ManagedServersListLayout />
              </FlaggedPage>
            ),

            children: [
              {
                path: 'managed-servers',
                element: <ManagedServersPage />
              },
              {
                path: 'custom-providers',
                element: <ManagedServersPage />
              }
            ]
          },

          {
            path: '',
            element: (
              <FlaggedPage flag="metorial-gateway-enabled">
                <ExternalServersListLayout />
              </FlaggedPage>
            ),

            children: [
              {
                path: 'external-servers',
                element: <ExternalServersPage />
              },
              {
                path: 'external-providers',
                element: <ExternalServersPage />
              }
            ]
          },

          {
            path: 'custom-provider/:customServerId',
            element: (
              <FlaggedPage flag="metorial-gateway-enabled">
                <CustomServerLayout />
              </FlaggedPage>
            ),

            children: [
              {
                path: '',
                element: <CustomServerOverviewPage />
              },
              {
                path: 'versions',
                element: <CustomServerVersionsPage />
              },
              {
                path: 'code',
                element: <CustomServerCodePage />
              },
              {
                path: 'commits',
                element: <CustomServerCommitsPage />
              },
              {
                path: 'deployments',
                element: <CustomServerDeploymentsPage />
              },
              {
                path: 'settings',
                element: <CustomServerSettingsPage />
              },
              {
                path: 'listing',
                element: <CustomServerListingPage />
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
