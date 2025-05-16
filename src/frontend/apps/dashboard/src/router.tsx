import { createFrontendRouter } from '@metorial/microfrontend';
import { Outlet } from 'react-router-dom';
import { accountSlice } from './slices/account';
import { authSlice } from './slices/auth';
import { indexSlice } from './slices/index';
import { joinSlice } from './slices/join';
import { organizationSlice } from './slices/organization';
import { productSlice } from './slices/product';
import { welcomeSlice } from './slices/welcome';

export let App = createFrontendRouter({
  frontends: [
    indexSlice(''),
    authSlice('auth'),
    accountSlice('account'),
    organizationSlice('o'),
    welcomeSlice('welcome'),
    joinSlice('join'),
    authSlice('auth'),
    productSlice('i')
  ],
  layout: <Outlet />
});
