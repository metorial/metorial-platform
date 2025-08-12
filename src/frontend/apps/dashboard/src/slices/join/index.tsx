import { dynamicPage } from '@metorial/dynamic-component/src/dynamicComponent';
import { createSlice } from '@metorial/microfrontend';

let OrganizationInvitePage = dynamicPage(() =>
  import('./pages/orgInvite').then(c => c.OrganizationInvitePage)
);

export let joinSlice = createSlice([
  {
    path: '',
    element: <OrganizationInvitePage />
  }
]);
