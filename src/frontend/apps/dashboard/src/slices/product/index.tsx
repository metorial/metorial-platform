import { renderWithLoader } from '@metorial/data-hooks';
import { createSlice } from '@metorial/microfrontend';
import { NotFound } from '@metorial/pages';
import { useDashboardFlags } from '@metorial/state';
import { Outlet } from 'react-router-dom';
import { ProjectHomePage } from './pages';
import {
  ExternalServersListLayout,
  ManagedServersListLayout
} from './pages/(custom-servers)/(list)/_layout';
import { ExternalServersPage } from './pages/(custom-servers)/(list)/external-servers';
import { ManagedServersPage } from './pages/(custom-servers)/(list)/managed-servers';
import { ProviderConnectionsPage } from './pages/(custom-servers)/(list)/provider-connections';
import { LogsListLayout } from './pages/(logs)/(list)/_layout';
import { ServerErrorsPage } from './pages/(logs)/(list)/server-errors';
import { ServerRunsPage } from './pages/(logs)/(list)/server-runs';
import { SessionsPage } from './pages/(logs)/(list)/sessions';
import { ServerErrorPage } from './pages/(logs)/server-error';
import { ServerErrorLayout } from './pages/(logs)/server-error/_layout';
import { ServerRunPage } from './pages/(logs)/server-run';
import { ServerRunLayout } from './pages/(logs)/server-run/_layout';
import { SessionPage } from './pages/(logs)/session';
import { SessionLayout } from './pages/(logs)/session/_layout';
import { SessionDeploymentsPage } from './pages/(logs)/session/deployments';
import { SessionServerRunsPage } from './pages/(logs)/session/serverRuns';
import {
  ServerDeploymentsListLayout,
  ServersListLayout
} from './pages/(servers)/(list)/_layout';
import { ServersDeploymentsPage } from './pages/(servers)/(list)/server-deployments';
import { ServersImplementationsPage } from './pages/(servers)/(list)/server-implementations';
import { ServersPage } from './pages/(servers)/(list)/servers';
import { ServerOverviewPage } from './pages/(servers)/server';
import { ServerDeploymentLayout } from './pages/(servers)/server-deployment/_layout';
import { ServerDeploymentConfigPage } from './pages/(servers)/server-deployment/config';
import { ServerDeploymentErrorsPage } from './pages/(servers)/server-deployment/errors';
import { ServerDeploymentOverviewPage } from './pages/(servers)/server-deployment/overview';
import { ServerDeploymentRunsPage } from './pages/(servers)/server-deployment/runs';
import { ServerImplementationLayout } from './pages/(servers)/server-implementation/_layout';
import { ServerImplementationConfigPage } from './pages/(servers)/server-implementation/config';
import { ServerImplementationDeploymentsPage } from './pages/(servers)/server-implementation/deployments';
import { ServerImplementationErrorsPage } from './pages/(servers)/server-implementation/errors';
import { ServerImplementationOverviewPage } from './pages/(servers)/server-implementation/overview';
import { ServerImplementationRunsPage } from './pages/(servers)/server-implementation/runs';
import { ServerLayout } from './pages/(servers)/server/_layout';
import { ServerServerDeploymentsPage } from './pages/(servers)/server/deployments';
import { ServerServerImplementationsPage } from './pages/(servers)/server/implementations';
import { ServerReadmePage } from './pages/(servers)/server/readme';
import { ProjectPageLayout } from './pages/_layout';
import { DeployPage } from './pages/deploy';
import { ProjectDeveloperPage } from './pages/developer';
import { ProjectDeveloperPageLayout } from './pages/developer/_layout';
import { ProjectDeveloperAPIPage } from './pages/developer/api';
import { ProjectDeveloperEnvironmentsPage } from './pages/developer/environments';
import { ExplorerPage } from './pages/explorer';
import { ProjectSettingsPage } from './pages/settings';
import { ProjectSettingsPageLayout } from './pages/settings/_layout';

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
              },
              {
                path: 'provider-connections',
                element: <ProviderConnectionsPage />
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
