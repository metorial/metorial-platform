import { createSlice } from '@metorial/microfrontend';
import { WelcomeCreateOrganizationPage } from './pages/createOrganization';
import { WelcomeCreateProjectPage } from './pages/createProject';
import { WelcomeSetupProjectPage } from './pages/setupProject';

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
      }
    ]
  }
]);
