import { renderWithLoader } from '@metorial/data-hooks';
import { dynamicPage } from '@metorial/dynamic-component';
import { createSlice } from '@metorial/microfrontend';
import { NotFound } from '@metorial/pages';
import { lastInstanceIdStore, useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { ProjectHomePage } from './pages';

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
  import('./pages/(provider-api)/(list)/provider-auth-credentials').then(
    c => c.ProviderAuthCredentialsOverviewPage
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
    c => c.ProviderAuthConnectionLayout
  )
);
let ProviderAuthConnectionOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-configs/index').then(
    c => c.ProviderAuthConnectionOverviewPage
  )
);
let ProviderAuthConnectionSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-configs/settings').then(
    c => c.ProviderAuthConnectionSettingsPage
  )
);
let ProviderSessionLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/_layout').then(c => c.ProviderSessionLayout)
);
let ProviderSessionOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/index').then(
    c => c.ProviderSessionOverviewPage
  )
);
let ProviderSessionProvidersPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/providers').then(
    c => c.ProviderSessionProvidersPage
  )
);
let ProviderSessionSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/settings').then(
    c => c.ProviderSessionSettingsPage
  )
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

let MagicMcpServerLayout = dynamicPage(() =>
  import('./pages/magic-mcp/server/_layout').then(c => c.MagicMcpServerLayout)
);
let MagicMcpServerConfigPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/config').then(c => c.MagicMcpServerConfigPage)
);
let MagicMcpServerErrorsPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/errors').then(c => c.MagicMcpServerErrorsPage)
);
let MagicMcpServerOauthPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/oauth').then(c => c.MagicMcpServerOauthPage)
);
let MagicMcpServerOverviewPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/overview').then(c => c.MagicMcpServerOverviewPage)
);
let MagicMcpServerRunsPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/runs').then(c => c.MagicMcpServerRunsPage)
);
let MagicMcpServerSessionsPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/sessions').then(c => c.MagicMcpServerSessionsPage)
);
let MagicMcpGroupsPage = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/groups').then(c => c.MagicMcpGroupsPage)
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
  import('./pages/(custom-servers)/custom-server/code').then(c => c.CustomServerCodePage)
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
let ProviderConnectionOverviewPage = dynamicPage(() =>
  import('./pages/(custom-servers)/provider-connection').then(
    c => c.ProviderConnectionOverviewPage
  )
);
let ProviderConnectionLogsPage = dynamicPage(() =>
  import('./pages/(custom-servers)/provider-connection/logs').then(
    c => c.ProviderConnectionLogsPage
  )
);
let ProviderConnectionProfilesPage = dynamicPage(() =>
  import('./pages/(custom-servers)/provider-connection/profiles').then(
    c => c.ProviderConnectionProfilesPage
  )
);
let ProviderConnectionSettingsPage = dynamicPage(() =>
  import('./pages/(custom-servers)/provider-connection/settings').then(
    c => c.ProviderConnectionSettingsPage
  )
);
let ProviderConnectionLayout = dynamicPage(() =>
  import('./pages/(custom-servers)/provider-connection/_layout').then(
    c => c.ProviderConnectionLayout
  )
);
let ProviderConnectionTestResponsePage = dynamicPage(() =>
  import('./pages/(custom-servers)/provider-connection/testResponse').then(
    c => c.ProviderConnectionTestResponsePage
  )
);
let CustomServerOverviewPage = dynamicPage(() =>
  import('./pages/(custom-servers)/custom-server').then(c => c.CustomServerOverviewPage)
);
let CustomServerVersionsPage = dynamicPage(() =>
  import('./pages/(custom-servers)/custom-server/versions').then(
    c => c.CustomServerVersionsPage
  )
);
let CustomServerSettingsPage = dynamicPage(() =>
  import('./pages/(custom-servers)/custom-server/settings/settings').then(
    c => c.CustomServerSettingsPage
  )
);
let CustomServerLayout = dynamicPage(() =>
  import('./pages/(custom-servers)/custom-server/_layout').then(c => c.CustomServerLayout)
);
let ProviderConnectionsListLayout = dynamicPage(() =>
  import('./pages/(custom-servers)/(list)/_layout').then(c => c.ProviderConnectionsListLayout)
);
let ManagedServersListLayout = dynamicPage(() =>
  import('./pages/(custom-servers)/(list)/_layout').then(c => c.ManagedServersListLayout)
);
let ExternalServersListLayout = dynamicPage(() =>
  import('./pages/(custom-servers)/(list)/_layout').then(c => c.ExternalServersListLayout)
);
let ExternalServersPage = dynamicPage(() =>
  import('./pages/(custom-servers)/(list)/external-servers').then(c => c.ExternalServersPage)
);
let ManagedServersPage = dynamicPage(() =>
  import('./pages/(custom-servers)/(list)/managed-servers').then(c => c.ManagedServersPage)
);
let ProviderConnectionsPage = dynamicPage(() =>
  import('./pages/(custom-servers)/(list)/provider-connections').then(
    c => c.ProviderConnectionsPage
  )
);
let LogsListLayout = dynamicPage(() =>
  import('./pages/(logs)/(list)/_layout').then(c => c.LogsListLayout)
);
let ServerErrorsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/server-errors').then(c => c.ServerErrorsPage)
);
let ServerRunsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/server-runs').then(c => c.ServerRunsPage)
);
let SessionsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/sessions').then(c => c.SessionsPage)
);
let ServerErrorPage = dynamicPage(() =>
  import('./pages/(logs)/server-error').then(c => c.ServerErrorPage)
);
let ServerErrorLayout = dynamicPage(() =>
  import('./pages/(logs)/server-error/_layout').then(c => c.ServerErrorLayout)
);
let ServerRunPage = dynamicPage(() =>
  import('./pages/(logs)/server-run').then(c => c.ServerRunPage)
);
let ServerRunLayout = dynamicPage(() =>
  import('./pages/(logs)/server-run/_layout').then(c => c.ServerRunLayout)
);
let SessionPage = dynamicPage(() => import('./pages/(logs)/session').then(c => c.SessionPage));
let SessionLayout = dynamicPage(() =>
  import('./pages/(logs)/session/_layout').then(c => c.SessionLayout)
);
let SessionDeploymentsPage = dynamicPage(() =>
  import('./pages/(logs)/session/deployments').then(c => c.SessionDeploymentsPage)
);
let SessionServerRunsPage = dynamicPage(() =>
  import('./pages/(logs)/session/serverRuns').then(c => c.SessionServerRunsPage)
);
let ProjectPageLayout = dynamicPage(() =>
  import('./pages/_layout').then(c => c.ProjectPageLayout)
);
let DeployPage = dynamicPage(() => import('./pages/deploy').then(c => c.DeployPage));
let ProjectDeveloperPage = dynamicPage(() =>
  import('./pages/developer').then(c => c.ProjectDeveloperPage)
);
let ProjectDeveloperPageLayout = dynamicPage(() =>
  import('./pages/developer/_layout').then(c => c.ProjectDeveloperPageLayout)
);
let ProjectDeveloperAPIPage = dynamicPage(() =>
  import('./pages/developer/api').then(c => c.ProjectDeveloperAPIPage)
);
let ProjectDeveloperEnvironmentsPage = dynamicPage(() =>
  import('./pages/developer/environments').then(c => c.ProjectDeveloperEnvironmentsPage)
);
let ExplorerPage = dynamicPage(() => import('./pages/explorer').then(c => c.ExplorerPage));
let ProjectSettingsPage = dynamicPage(() =>
  import('./pages/settings').then(c => c.ProjectSettingsPage)
);
let ProjectSettingsPageLayout = dynamicPage(() =>
  import('./pages/settings/_layout').then(c => c.ProjectSettingsPageLayout)
);
let CustomServerDeploymentsPage = dynamicPage(() =>
  import('./pages/(custom-servers)/custom-server/deployments').then(
    c => c.CustomServerDeploymentsPage
  )
);
let CustomServerListingPage = dynamicPage(() =>
  import('./pages/(custom-servers)/custom-server/settings/listing').then(
    c => c.CustomServerListingPage
  )
);
let CommunityServersPage = dynamicPage(() =>
  import('./pages/community/communityServers').then(c => c.CommunityServersPage)
);
let CommunityProfilePage = dynamicPage(() =>
  import('./pages/community/profile').then(c => c.CommunityProfilePage)
);
let NotFoundPage = dynamicPage(() => import('@metorial/pages').then(c => c.NotFound));
let FlaggedPage = ({ children, flag }: { children: React.ReactNode; flag: string }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) =>
    (flags.data.flags as any)[flag] ? children : <NotFound />
  );
};
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
let CallbackDestinationsPage = dynamicPage(() =>
  import('./pages/(callbacks)/destinations').then(c => c.CallbackDestinationsPage)
);
let CallbackLogsPage = dynamicPage(() =>
  import('./pages/(callbacks)/logs').then(c => c.CallbackLogsPage)
);
let PortalsListLayout = dynamicPage(() =>
  import('./pages/(portals)/(list)/_layout').then(c => c.PortalsListLayout)
);
let PortalsPage = dynamicPage(() =>
  import('./pages/(portals)/(list)/portals').then(c => c.PortalsPage)
);
let PortalLayout = dynamicPage(() =>
  import('./pages/(portals)/portal/_layout').then(c => c.PortalLayout)
);
let PortalGroupSettingsPage = dynamicPage(() =>
  import('./pages/(portals)/portal/group/settings').then(c => c.PortalGroupSettingsPage)
);
let PortalGroupOverviewPage = dynamicPage(() =>
  import('./pages/(portals)/portal/group/index').then(c => c.PortalGroupOverviewPage)
);
let PortalGroupLayout = dynamicPage(() =>
  import('./pages/(portals)/portal/group/_layout').then(c => c.PortalGroupLayout)
);
let PortalSettingsLayout = dynamicPage(() =>
  import('./pages/(portals)/portal/settings/_layout').then(c => c.PortalSettingsLayout)
);
let PortalSettingsOverviewPage = dynamicPage(() =>
  import('./pages/(portals)/portal/settings/index').then(c => c.PortalSettingsOverviewPage)
);
let PortalSettingsAuthPage = dynamicPage(() =>
  import('./pages/(portals)/portal/settings/auth').then(c => c.PortalSettingsAuthPage)
);
let PortalGroupsPage = dynamicPage(() =>
  import('./pages/(portals)/portal/groups').then(c => c.PortalGroupsPage)
);
let PortalOverviewPage = dynamicPage(() =>
  import('./pages/(portals)/portal/index').then(c => c.PortalOverviewPage)
);
let PortalUsersPage = dynamicPage(() =>
  import('./pages/(portals)/portal/users').then(c => c.PortalUsersPage)
);
let PortalUserPage = dynamicPage(() =>
  import('./pages/(portals)/portal/user').then(c => c.PortalUserPage)
);
let PortalServerRequestsPage = dynamicPage(() =>
  import('./pages/(portals)/portal/server-requests').then(c => c.PortalServerRequestsPage)
);
let PortalFeaturedServersPage = dynamicPage(() =>
  import('./pages/(portals)/portal/settings/featured-servers').then(
    c => c.PortalFeaturedServersPage
  )
);

let ProductWrapper = () => {
  let instance = useCurrentInstance();

  useEffect(() => {
    if (!instance.data) return;
    lastInstanceIdStore.set(instance.data.instanceId);
  }, [instance.data]);

  return <Outlet />;
};

export let productInnerSlice = createSlice([
  {
    path: ':organizationId/:projectId/:instanceId',
    element: <ProductWrapper />,

    children: [
      {
        path: '',
        element: <ProjectHomePage />
      },

      {
        path: 'settings',
        element: <ProjectSettingsPageLayout />,

        children: [
          {
            path: '',
            element: <ProjectSettingsPage />
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
          },
          {
            path: 'environments',
            element: <ProjectDeveloperEnvironmentsPage />
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
            path: '',
            element: (
              <FlaggedPage flag="metorial-gateway-enabled">
                <ProviderConnectionsListLayout />
              </FlaggedPage>
            ),

            children: [
              {
                path: 'provider-connections',
                element: <ProviderConnectionsPage />
              }
            ]
          },

          {
            path: 'custom-server/:customServerId',
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
          },

          {
            path: 'provider-connection/:providerConnectionId',
            element: (
              <FlaggedPage flag="metorial-gateway-enabled">
                <ProviderConnectionLayout />
              </FlaggedPage>
            ),

            children: [
              {
                path: '',
                element: <ProviderConnectionOverviewPage />
              },
              {
                path: 'logs',
                element: <ProviderConnectionLogsPage />
              },
              {
                path: 'profiles',
                element: <ProviderConnectionProfilesPage />
              },
              {
                path: 'settings',
                element: <ProviderConnectionSettingsPage />
              },
              {
                path: 'test-response',
                element: <ProviderConnectionTestResponsePage />
              }
            ]
          }
        ]
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
            path: 'provider-error/:serverErrorId',
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
            path: 'provider-run/:serverRunId',
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
            path: 'destinations',
            element: <CallbackDestinationsPage />
          },
          {
            path: 'logs',
            element: <CallbackLogsPage />
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
        path: 'magic-mcp',

        children: [
          {
            element: <MagicMcpListLayout />,

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
            element: <MagicMcpServerLayout />,

            children: [
              {
                path: '',
                element: <MagicMcpServerOverviewPage />
              },
              {
                path: 'config',
                element: <MagicMcpServerConfigPage />
              },
              {
                path: 'runs',
                element: <MagicMcpServerRunsPage />
              },
              {
                path: 'errors',
                element: <MagicMcpServerErrorsPage />
              },
              {
                path: 'oauth',
                element: <MagicMcpServerOauthPage />
              },
              {
                path: 'sessions',
                element: <MagicMcpServerSessionsPage />
              }
            ]
          },

          {
            path: 'group/:magicMcpGroupId',
            element: <MagicMcpGroupLayout />,

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
            path: 'overview',
            element: <ProviderSessionOverviewPage />
          },
          {
            path: 'providers',
            element: <ProviderSessionProvidersPage />
          },
          {
            path: 'settings',
            element: <ProviderSessionSettingsPage />
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
       * Explorer
       *************** */
      {
        path: 'explorer',
        element: <ExplorerPage />
      },

      {
        path: 'community',
        children: [
          {
            path: 'profile',
            element: <CommunityProfilePage />
          },
          {
            path: 'servers',
            element: <CommunityServersPage />
          }
        ]
      },

      {
        path: 'portals',
        element: <PortalsListLayout />,

        children: [
          {
            path: '',
            element: <PortalsPage />
          }
        ]
      },

      {
        path: 'portal/:portalId',
        element: <PortalLayout />,

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
                element: <PortalSettingsAuthPage />
              },
              {
                path: 'featured-servers',
                element: <PortalFeaturedServersPage />
              }
            ]
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
