import { ModalRoot, Toaster } from '@metorial/ui';
import { useEffect, useMemo } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { RouterErrorPage } from './pages/_error/routerError';
import { Layout } from './pages/_layout';
import { LoginPage } from './pages/login';
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
                children: [{ path: '', element: <h1>Hello</h1> }]
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
