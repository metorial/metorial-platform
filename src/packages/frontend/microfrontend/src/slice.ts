import { joinPaths } from '@metorial/join-paths';
import { ErrorPage, NotFound } from '@metorial/pages';
import { ModalRoot, Toaster } from '@metorial/ui';
import React, { ReactNode } from 'react';
import {
  createBrowserRouter,
  NonIndexRouteObject,
  Outlet,
  RouterProvider,
  useRouteError
} from 'react-router-dom';

let Context = React.createContext<{ path: string } | null>(null);

export let useGetPathWithPrefix = () => {
  let context = React.useContext(Context);
  return (...paths: string[]) => joinPaths(context?.path ?? '', ...paths);
};

export let createSlice = <T extends NonIndexRouteObject[]>(
  routes: T,
  opts?: { onInit?: (prefix: string) => any }
) => {
  let currentRoutes = { current: routes as NonIndexRouteObject[] };

  let run = (prefix: string) => {
    opts?.onInit?.(prefix);

    return {
      routes: {
        path: prefix,
        element: React.createElement(
          Context.Provider,
          { value: { path: prefix } },
          React.createElement(Outlet, null) as any
        ),
        children: routes
      } satisfies NonIndexRouteObject
    };
  };

  return Object.assign(run, {
    modify: (cb: (current: T) => NonIndexRouteObject[]) => {
      currentRoutes.current = cb(routes);
      return run;
    },

    get routes() {
      return currentRoutes.current;
    }
  });
};

export type Slice = ReturnType<ReturnType<typeof createSlice>>;

export let RouterErrorPage = () => {
  let error = useRouteError();

  if ((error as any)?.status === 404) return React.createElement(NotFound, { error });

  return React.createElement(ErrorPage, {
    title: 'An error occurred',
    description: `An error occurred while trying to render this page: ${
      (error as any).message ?? 'unknown error'
    }`
  });
};

export let createFrontendRouter = ({
  frontends,
  layout
}: {
  frontends: Slice[];
  layout: ReactNode;
}) => {
  let router = createBrowserRouter([
    {
      path: '/',
      element: React.createElement(
        React.Fragment,
        null,
        React.createElement(Outlet, null),
        React.createElement(Toaster, null),
        React.createElement(ModalRoot, null)
      ),
      errorElement: React.createElement(RouterErrorPage, null),
      children: [
        {
          path: '',
          element: layout,
          children: frontends.map(frontend => frontend.routes)
        }
      ]
    }
  ]);

  return () => {
    return React.createElement(RouterProvider, { router }, null);
  };
};
