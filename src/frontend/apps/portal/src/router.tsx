import { ModalRoot, Toaster } from '@metorial/ui';
import { useEffect, useMemo } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { HomePage } from './pages/(auth)';
import { ServersPage } from './pages/(auth)/(servers)/(list)/servers';
import { ServerPage } from './pages/(auth)/(servers)/server';
import { ServerLayout } from './pages/(auth)/(servers)/server/_layout';
import { ServerServerDeploymentsPage } from './pages/(auth)/(servers)/server/deployments';
import { LoginPage } from './pages/(unauthenticated)/login';
import { RouterErrorPage } from './pages/_error/routerError';
import { Layout } from './pages/_layout';
import { useBoot } from './state/portal/client';

export let App = () => {
  let boot = useBoot();

  useEffect(() => {
    if (!boot.data) return;

    let bootElement = document.querySelector('.mte_boot') as HTMLDivElement;
    if (!bootElement) return;

    bootElement.style.opacity = '0';
    bootElement.style.pointerEvents = 'none';
    bootElement.style.transition = 'opacity 0.2s ease-in-out';
    setTimeout(() => {
      bootElement.remove();
    }, 200);
  }, [boot.data]);

  let router = useMemo(() => {
    if (!boot.data) return null;

    let portalUrl = new URL(boot.data.portalUrl);
    let basePath = portalUrl.pathname.split('/').filter(Boolean).join('/');
    if (basePath == '/') basePath = '';

    return createBrowserRouter([
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
            path: basePath,
            children: [
              {
                path: 'login',
                element: <LoginPage />
              },
              {
                path: '',
                element: <Layout />,
                children: [
                  { path: '', element: <HomePage /> },

                  { path: 'servers', element: <ServersPage /> },
                  {
                    path: 'server/:serverId',
                    element: <ServerLayout />,
                    children: [
                      { path: '', element: <ServerPage /> },
                      { path: 'deployments', element: <ServerServerDeploymentsPage /> }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]);
  }, [boot]);

  if (boot.isLoading || !router) {
    return null;
  }

  return <RouterProvider router={router} />;
};
