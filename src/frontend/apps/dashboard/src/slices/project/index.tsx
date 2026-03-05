import { dynamicPage } from '@metorial/dynamic-component';
import { createSlice } from '@metorial/microfrontend';

let Layout = dynamicPage(() =>
  import('./pages/_layout').then(c => c.ProjectSettingsPageLayout)
);
let ProjectSettingsPage = dynamicPage(() =>
  import('./pages/index').then(c => c.ProjectSettingsPage)
);
let ProjectSettingsInstancesPage = dynamicPage(() =>
  import('./pages/instances').then(c => c.ProjectSettingsInstancesPage)
);

export let projectSlice = createSlice([
  {
    path: ':organizationId/:projectId/settings',
    element: <Layout />,

    children: [
      {
        path: '',
        element: <ProjectSettingsPage />
      },

      {
        path: 'instances',
        element: <ProjectSettingsInstancesPage />
      }
    ]
  }
]);
