import { dynamicPage } from '@metorial/dynamic-component';
import { createSlice } from '@metorial/microfrontend';

let Layout = dynamicPage(() =>
  import('./pages/_layout').then(c => c.ProjectSettingsPageLayout)
);
let ProjectSettingsPage = dynamicPage(() =>
  import('./pages/index').then(c => c.ProjectSettingsPage)
);
let ProjectBrandingPage = dynamicPage(() =>
  import('./pages/branding').then(c => c.ProjectBrandingPage)
);
let ProjectSettingsInstancesPage = dynamicPage(() =>
  import('./pages/instances').then(c => c.ProjectSettingsInstancesPage)
);
let ProjectSettingsDelegationConfigPage = dynamicPage(() =>
  import('./pages/delegation-config').then(c => c.ProjectSettingsDelegationConfigPage)
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
        path: 'branding',
        element: <ProjectBrandingPage />
      },

      {
        path: 'instances',
        element: <ProjectSettingsInstancesPage />
      },

      {
        path: 'delegation-config',
        element: <ProjectSettingsDelegationConfigPage />
      }
    ]
  }
]);
