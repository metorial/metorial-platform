import { createSlice } from '@metorial/microfrontend';
import { RootRedirect } from './pages/rootRedirect';

export let indexSlice = createSlice([
  {
    path: '',
    element: <RootRedirect />
  },
  {
    path: '',
    element: <RootRedirect />
  }
]);
