import { createSlice } from '@metorial/microfrontend';
import { Outlet } from 'react-router-dom';
import { ProjectHomePage } from './pages';
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
