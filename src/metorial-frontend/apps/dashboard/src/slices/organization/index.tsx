import { createSlice } from '@metorial/microfrontend';
import { OrganizationSettingsPage } from './pages';
import { OrganizationSettingsTeamLayout } from './pages/(team)/_layout';
import { OrganizationSettingsInvitesPage } from './pages/(team)/invite';
import { OrganizationSettingsMembersPage } from './pages/(team)/members';
import { OrganizationPageLayout } from './pages/_layout';
import { OrganizationSettingsProjectsPage } from './pages/projects';

export let organizationSlice = createSlice([
  {
    path: ':organizationId',
    element: <OrganizationPageLayout />,

    children: [
      {
        path: '',
        element: <OrganizationSettingsPage />
      },
      {
        path: 'projects',
        element: <OrganizationSettingsProjectsPage />
      },

      {
        element: <OrganizationSettingsTeamLayout />,

        children: [
          {
            path: 'members',
            element: <OrganizationSettingsMembersPage />
          },
          {
            path: 'invites',
            element: <OrganizationSettingsInvitesPage />
          }
        ]
      }
    ]
  }
]);
