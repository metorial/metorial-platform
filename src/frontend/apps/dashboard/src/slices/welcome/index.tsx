import { dynamicPage } from '@metorial/dynamic-component/src/dynamicComponent';
import { createSlice } from '@metorial/microfrontend';

let WelcomeCreateOrganizationPage = dynamicPage(() =>
  import('./pages/createOrganization').then(c => c.WelcomeCreateOrganizationPage)
);
let WelcomeCreateProjectPage = dynamicPage(() =>
  import('./pages/createProject').then(c => c.WelcomeCreateProjectPage)
);
let JumpstartPage = dynamicPage(() => import('./pages/jumpstart').then(c => c.JumpstartPage));
let WelcomeSetupProjectPage = dynamicPage(() =>
  import('./pages/setupProject').then(c => c.WelcomeSetupProjectPage)
);

export let welcomeSlice = createSlice([
  {
    path: '',
    children: [
      {
        path: '',
        element: <WelcomeCreateOrganizationPage />
      },
      {
        path: 'project',
        element: <WelcomeSetupProjectPage />
      },
      {
        path: 'create-project',
        element: <WelcomeCreateProjectPage />
      },

      {
        path: 'jumpstart',
        element: <JumpstartPage />
      }
    ]
  }
]);
