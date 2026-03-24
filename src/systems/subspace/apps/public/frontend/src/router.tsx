import { ModalRoot, Toaster } from '@metorial-io/ui';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { RouterErrorPage } from './pages/_error/routerError';
import { SetupSessionPage } from './pages/setupSession';

let router = createBrowserRouter([
  {
    path: '/',
    element: (
      <>
        <Outlet />
        <Toaster />
        <ModalRoot />
      </>
    ),
    errorElement: <RouterErrorPage />,
    children: [
      {
        path: '',
        children: [{ path: 'setup-session/:sessionId', element: <SetupSessionPage /> }]
      }
    ]
  }
]);

export let App = () => {
  return <RouterProvider router={router} />;
};
