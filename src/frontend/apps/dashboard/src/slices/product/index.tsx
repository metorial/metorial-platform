import { renderWithLoader } from '@metorial/data-hooks';
import { dynamicPage } from '@metorial/dynamic-component';
import { createSlice } from '@metorial/microfrontend';
import { NotFound } from '@metorial/pages';
import { useDashboardFlags } from '@metorial/state';
import { Outlet } from 'react-router-dom';
import { ProjectHomePage } from './pages';
import { CustomServerCodePage } from './pages/(custom-servers)/custom-server/code';

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
  import('./pages/(custom-servers)/custom-server/settings').then(
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
let ServersListLayout = dynamicPage(() =>
  import('./pages/(servers)/(list)/_layout').then(c => c.ServersListLayout)
);
let ServerDeploymentsListLayout = dynamicPage(() =>
  import('./pages/(servers)/(list)/_layout').then(c => c.ServerDeploymentsListLayout)
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
let ServersDeploymentsPage = dynamicPage(() =>
  import('./pages/(servers)/(list)/server-deployments').then(c => c.ServersDeploymentsPage)
);
let ServersImplementationsPage = dynamicPage(() =>
  import('./pages/(servers)/(list)/server-implementations').then(
    c => c.ServersImplementationsPage
  )
);
let ServersPage = dynamicPage(() =>
  import('./pages/(servers)/(list)/servers').then(c => c.ServersPage)
);
let ServerOverviewPage = dynamicPage(() =>
  import('./pages/(servers)/server').then(c => c.ServerOverviewPage)
);
let ServerDeploymentLayout = dynamicPage(() =>
  import('./pages/(servers)/server-deployment/_layout').then(c => c.ServerDeploymentLayout)
);
let ServerDeploymentConfigPage = dynamicPage(() =>
  import('./pages/(servers)/server-deployment/config').then(c => c.ServerDeploymentConfigPage)
);
let ServerDeploymentErrorsPage = dynamicPage(() =>
  import('./pages/(servers)/server-deployment/errors').then(c => c.ServerDeploymentErrorsPage)
);
let ServerDeploymentOverviewPage = dynamicPage(() =>
  import('./pages/(servers)/server-deployment/overview').then(
    c => c.ServerDeploymentOverviewPage
  )
);
let ServerDeploymentRunsPage = dynamicPage(() =>
  import('./pages/(servers)/server-deployment/runs').then(c => c.ServerDeploymentRunsPage)
);
let ServerImplementationLayout = dynamicPage(() =>
  import('./pages/(servers)/server-implementation/_layout').then(
    c => c.ServerImplementationLayout
  )
);
let ServerImplementationConfigPage = dynamicPage(() =>
  import('./pages/(servers)/server-implementation/config').then(
    c => c.ServerImplementationConfigPage
  )
);
let ServerImplementationDeploymentsPage = dynamicPage(() =>
  import('./pages/(servers)/server-implementation/deployments').then(
    c => c.ServerImplementationDeploymentsPage
  )
);
let ServerImplementationErrorsPage = dynamicPage(() =>
  import('./pages/(servers)/server-implementation/errors').then(
    c => c.ServerImplementationErrorsPage
  )
);
let ServerImplementationOverviewPage = dynamicPage(() =>
  import('./pages/(servers)/server-implementation/overview').then(
    c => c.ServerImplementationOverviewPage
  )
);
let ServerImplementationRunsPage = dynamicPage(() =>
  import('./pages/(servers)/server-implementation/runs').then(
    c => c.ServerImplementationRunsPage
  )
);
let ServerLayout = dynamicPage(() =>
  import('./pages/(servers)/server/_layout').then(c => c.ServerLayout)
);
let ServerServerDeploymentsPage = dynamicPage(() =>
  import('./pages/(servers)/server/deployments').then(c => c.ServerServerDeploymentsPage)
);
let ServerServerImplementationsPage = dynamicPage(() =>
  import('./pages/(servers)/server/implementations').then(
    c => c.ServerServerImplementationsPage
  )
);
let ServerReadmePage = dynamicPage(() =>
  import('./pages/(servers)/server/readme').then(c => c.ServerReadmePage)
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
let NotFoundPage = dynamicPage(() => import('@metorial/pages').then(c => c.NotFound));
let FlaggedPage = ({ children, flag }: { children: React.ReactNode; flag: string }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) =>
    (flags.data.flags as any)[flag] ? children : <NotFound />
  );
};

export let productInnerSlice = createSlice([
  {
    path: ':organizationId/:projectId/:instanceId',
    element: <Outlet />,

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
                path: 'settings',
                element: <CustomServerSettingsPage />
              },
              {
                path: 'deployments',
                element: <CustomServerDeploymentsPage />
              },
              {
                path: 'code',
                element: <CustomServerCodePage />
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
          },

          {
            path: '',
            element: <ServersListLayout />,

            children: [
              {
                path: 'servers',
                element: <ServersPage />
              }
            ]
          },

          {
            path: '',
            element: <ServerDeploymentsListLayout />,

            children: [
              {
                path: 'server-deployments',
                element: <ServersDeploymentsPage />
              },
              {
                path: 'server-implementations',
                element: <ServersImplementationsPage />
              }
            ]
          },

          {
            path: 'server/:serverId',
            element: <ServerLayout />,

            children: [
              // {
              //   element: <ServerLayoutSide />,
              //   children: [
              //     {
              //       path: '',
              //       element: <ServerOverviewPage />
              //     }
              //   ]
              // },

              {
                path: '',
                element: <ServerOverviewPage />
              },

              {
                path: 'readme',
                element: <ServerReadmePage />
              },

              {
                path: 'deployments',
                element: <ServerServerDeploymentsPage />
              },
              {
                path: 'implementations',
                element: <ServerServerImplementationsPage />
              }
            ]
          },

          {
            path: 'server-deployment/:serverDeploymentId',
            element: <ServerDeploymentLayout />,

            children: [
              {
                path: '',
                element: <ServerDeploymentOverviewPage />
              },
              {
                path: 'config',
                element: <ServerDeploymentConfigPage />
              },
              {
                path: 'runs',
                element: <ServerDeploymentRunsPage />
              },
              {
                path: 'errors',
                element: <ServerDeploymentErrorsPage />
              }
            ]
          },

          {
            path: 'server-implementation/:serverImplementationId',
            element: <ServerImplementationLayout />,

            children: [
              {
                path: '',
                element: <ServerImplementationOverviewPage />
              },
              {
                path: 'config',
                element: <ServerImplementationConfigPage />
              },
              {
                path: 'runs',
                element: <ServerImplementationRunsPage />
              },
              {
                path: 'errors',
                element: <ServerImplementationErrorsPage />
              },
              {
                path: 'deployments',
                element: <ServerImplementationDeploymentsPage />
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
                path: 'server-errors',
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
       * Explorer
       *************** */
      {
        path: 'explorer',
        element: <ExplorerPage />
      }
    ]
  }
]);

export let deploySlice = createSlice([
  {
    path: ':organizationId/:projectId/:instanceId/deploy',
    element: <DeployPage />
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
