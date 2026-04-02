import { ModalRoot, Toaster } from '@metorial/ui';
import { useEffect, useMemo } from 'react';
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useParams
} from 'react-router-dom';
import { HomePage } from './pages/(auth)';
import { CatalogPage } from './pages/(auth)/catalog';
import { MagicMcpListLayout } from './pages/(auth)/magic-mcp/(list)/_layout';
import { MagicMcpServerPage } from './pages/(auth)/magic-mcp/(list)/servers';
import { MagicMcpSessionsPage } from './pages/(auth)/magic-mcp/(list)/sessions';
import { MagicMcpTokensPage } from './pages/(auth)/magic-mcp/(list)/tokens';
import { MagicMcpServerLayout } from './pages/(auth)/magic-mcp/server/_layout';
import { MagicMcpServerConfigPage } from './pages/(auth)/magic-mcp/server/config';
import { MagicMcpProviderOverviewPage } from './pages/(auth)/magic-mcp/server/overview';
import { MagicMcpServerSessionsPage } from './pages/(auth)/magic-mcp/server/sessions';
import { ProviderPage } from './pages/(auth)/provider';
import { LoginPage } from './pages/(unauthenticated)/login';
import { RouterErrorPage } from './pages/_error/routerError';
import { Layout } from './pages/_layout';
import { getPortalBasePath, useBoot } from './state/portal/client';
import { usePaths } from './state/portal/path';

let LegacyServersRedirect = () => {
  let paths = usePaths();

  return <Navigate to={paths.catalog()} replace />;
};

let LegacyServerRedirect = () => {
  let paths = usePaths();
  let { catalogItemId } = useParams();

  return (
    <Navigate to={catalogItemId ? paths.provider(catalogItemId) : paths.catalog()} replace />
  );
};

let LegacyMagicMcpServerRedirect = () => {
  let paths = usePaths();
  let { magicMcpServerId } = useParams();

  return (
    <Navigate
      to={magicMcpServerId ? paths.magicMcpServer(magicMcpServerId) : paths.magicMcpServers()}
      replace
    />
  );
};

let LegacyMagicMcpServerSessionsRedirect = () => {
  let paths = usePaths();
  let { magicMcpServerId } = useParams();

  return (
    <Navigate
      to={
        magicMcpServerId
          ? paths.magicMcpServerSessions(magicMcpServerId)
          : paths.magicMcpServers()
      }
      replace
    />
  );
};

let LegacyMagicMcpServerSettingsRedirect = () => {
  let paths = usePaths();
  let { magicMcpServerId } = useParams();

  return (
    <Navigate
      to={
        magicMcpServerId
          ? paths.magicMcpServerSettings(magicMcpServerId)
          : paths.magicMcpServers()
      }
      replace
    />
  );
};

export let App = () => {
  let boot = useBoot();

  useEffect(() => {
    if (!boot.data) return;

    let bootElement = document.querySelector('.mte_boot') as HTMLDivElement | null;
    if (!bootElement) return;

    bootElement.style.opacity = '0';
    bootElement.style.pointerEvents = 'none';
    bootElement.style.transition = 'opacity 0.2s ease-in-out';

    setTimeout(() => {
      document.body.classList.remove('loading');
      bootElement.remove();
    }, 500);
  }, [boot.data]);

  let router = useMemo(() => {
    if (!boot.data) return null;

    let routeBasePath = getPortalBasePath(boot.data.portalUrl)
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');

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
            path: routeBasePath,
            children: [
              {
                path: 'login',
                element: <LoginPage />
              },
              {
                path: '',
                element: <Layout />,
                children: [
                  {
                    path: '',
                    element: <HomePage />
                  },
                  {
                    path: 'catalog',
                    element: <CatalogPage />
                  },
                  {
                    path: 'servers/*',
                    element: <LegacyServersRedirect />
                  },
                  {
                    path: 'providers/:catalogItemId',
                    element: <ProviderPage />
                  },
                  {
                    path: 'server/:catalogItemId/*',
                    element: <LegacyServerRedirect />
                  },
                  {
                    path: 'magic-mcp',
                    children: [
                      {
                        path: '',
                        element: <Navigate to="servers" replace relative="path" />
                      },

                      {
                        element: <MagicMcpListLayout />,
                        children: [
                          {
                            path: 'servers',
                            element: <MagicMcpServerPage />
                          },
                          {
                            path: 'sessions',
                            element: <MagicMcpSessionsPage />
                          },
                          {
                            path: 'tokens',
                            element: <MagicMcpTokensPage />
                          }
                        ]
                      },

                      {
                        path: 'server/:magicMcpServerId',
                        element: <MagicMcpServerLayout />,
                        children: [
                          {
                            path: '',
                            element: <MagicMcpProviderOverviewPage />
                          },
                          {
                            path: 'sessions',
                            element: <MagicMcpServerSessionsPage />
                          },
                          {
                            path: 'settings',
                            element: <MagicMcpServerConfigPage />
                          },
                          {
                            path: 'config',
                            element: <Navigate to="../settings" replace relative="path" />
                          }
                        ]
                      }
                    ]
                  },
                  {
                    path: 'magic-mcp-servers',
                    element: <Navigate to="../magic-mcp/servers" replace relative="path" />
                  },
                  {
                    path: 'magic-mcp-sessions',
                    element: <Navigate to="../magic-mcp/sessions" replace relative="path" />
                  },
                  {
                    path: 'tokens',
                    element: <Navigate to="../magic-mcp/tokens" replace relative="path" />
                  },
                  {
                    path: 'magic-mcp-server/:magicMcpServerId',
                    element: <LegacyMagicMcpServerRedirect />
                  },
                  {
                    path: 'magic-mcp-server/:magicMcpServerId/sessions',
                    element: <LegacyMagicMcpServerSessionsRedirect />
                  },
                  {
                    path: 'magic-mcp-server/:magicMcpServerId/config',
                    element: <LegacyMagicMcpServerSettingsRedirect />
                  }
                ]
              }
            ]
          }
        ]
      }
    ]);
  }, [boot.data]);

  if (boot.isLoading || !router) {
    return null;
  }

  return <RouterProvider router={router} />;
};
