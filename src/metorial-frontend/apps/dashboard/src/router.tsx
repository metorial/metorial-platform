import { createFrontendRouter } from '@metorial/microfrontend';
import { Outlet } from 'react-router-dom';
import { productSlice } from './product';

export let App = createFrontendRouter({
  frontends: [productSlice('i')],
  layout: <Outlet />
});
