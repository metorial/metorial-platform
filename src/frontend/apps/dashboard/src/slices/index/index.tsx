import { createSlice } from '@metorial/microfrontend';
import { OrganizationRedirect } from './pages/organizationRedirect';
import { ProjectRedirect } from './pages/projectRedirect';
import { RootRedirect } from './pages/rootRedirect';
import { ServerRedirect } from './pages/serverRedirect';

export let indexSlice = createSlice([
  {
    path: '',
    element: <RootRedirect />
  },
  {
    path: 'o/:organizationId',
    element: <OrganizationRedirect />
  },
  {
    path: 'p/:organizationId',
    element: <OrganizationRedirect />
  },
  {
    path: 'i/:organizationId',
    element: <OrganizationRedirect />
  },
  {
    path: 'p/:organizationId/:projectId',
    element: <ProjectRedirect />
  },
  {
    path: 'i/:organizationId/:projectId',
    element: <ProjectRedirect />
  },

  {
    path: 'server/:serverId',
    element: <ServerRedirect />
  }
]);
