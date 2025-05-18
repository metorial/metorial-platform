import { createSlice } from '@metorial/microfrontend';
import { Outlet } from 'react-router-dom';
import { ProjectHomePage } from './pages';
import { ServersListLayout } from './pages/(servers)/(list)/_layout';
import { ServersPage } from './pages/(servers)/(list)/servers';
import { ServersDeploymentsPage } from './pages/(servers)/(list)/servers-deployments';
import { ServersImplementationsPage } from './pages/(servers)/(list)/servers-implementations';
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
import { ServerDeploymentsPage } from './pages/(servers)/server/deployments';
import { ServerImplementationsPage } from './pages/(servers)/server/implementations';
import { ServerRunsPage } from './pages/(servers)/server/runs';
import { ProjectPageLayout } from './pages/_layout';
import { ProjectDeveloperPage } from './pages/developer';
import { ProjectDeveloperPageLayout } from './pages/developer/_layout';
import { ProjectDeveloperAPIPage } from './pages/developer/api';
import { ProjectDeveloperEnvironmentsPage } from './pages/developer/environments';
import { ProjectSettingsPage } from './pages/settings';
import { ProjectSettingsPageLayout } from './pages/settings/_layout';

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

      {
        path: '',
        element: <ServersListLayout />,

        children: [
          {
            path: 'servers',
            element: <ServersPage />
          },
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
          {
            path: '',
            element: <ServerOverviewPage />
          },
          {
            path: 'deployments',
            element: <ServerDeploymentsPage />
          },
          {
            path: 'implementations',
            element: <ServerImplementationsPage />
          },
          {
            path: 'runs',
            element: <ServerRunsPage />
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
  }
]);

export let productSlice = createSlice([
  {
    element: <ProjectPageLayout />,
    children: productInnerSlice.routes
  }
]);
