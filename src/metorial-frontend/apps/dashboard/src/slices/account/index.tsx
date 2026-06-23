import { createSlice } from '@metorial/microfrontend';
import { AccountPage } from './pages';
import { AccountPageLayout } from './pages/_layout';

export let accountSlice = createSlice([
  {
    path: '',
    element: <AccountPageLayout />,
    children: [
      {
        path: '',
        element: <AccountPage />
      }
    ]
  }
]);
