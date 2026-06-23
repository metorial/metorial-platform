import { ModalRoot, Toaster } from '@metorial-io/ui';
import { useEffect, useRef } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { RouterErrorPage } from './pages/_error/routerError';
import { AuthIntent } from './pages/authIntent';
import { EmailVerified } from './pages/emailVerified';
import { Internal } from './pages/internal';
import { Login } from './pages/login';
import { Logout } from './pages/logout';
import { Signup } from './pages/signup';
import { Switch } from './pages/switch';

let Redirect = ({ to }: { to: string }) => {
  let navigatingRef = useRef(false);
  useEffect(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    window.location.replace(to);
  }, [to]);
  return null;
};

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
        element: <Redirect to="https://metorial.com" />
      },
      {
        path: 'login',
        element: <Login />
      },
      {
        path: 'signup',
        element: <Signup />
      },
      {
        path: 'switch',
        element: <Switch />
      },
      {
        path: 'auth-intent',
        element: <AuthIntent />
      },
      {
        path: 'email-verified',
        element: <EmailVerified />
      },
      {
        path: 'logout',
        element: <Logout />
      },
      {
        path: 'internal',
        element: <Internal />
      }
    ]
  }
]);

export let App = () => {
  return <RouterProvider router={router} />;
};
