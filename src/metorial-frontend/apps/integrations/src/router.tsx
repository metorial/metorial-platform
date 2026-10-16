import { ModalRoot, Toaster } from '@metorial/ui';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { RouterErrorPage } from './pages/_error';
import { IntegrationSetupSessionPage } from './pages/integration-setup-session';
import { SetupSessionPage } from './pages/setup-session';

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
      { path: 'setup-session/:sessionId', element: <SetupSessionPage /> },
      {
        path: 'integration-setup-session/:sessionId',
        element: <IntegrationSetupSessionPage />
      }
    ]
  }
]);

export let App = () => <RouterProvider router={router} />;
