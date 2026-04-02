import { AppLayout } from '@metorial/layout';
import { RiFlowChart, RiGridLine, RiHome6Line, RiKey2Line } from '@remixicon/react';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useBootWithAuth } from '../../state/portal/client';
import { usePaths } from '../../state/portal/path';
import { PortalNav } from './nav';

export let Layout = () => {
  let boot = useBootWithAuth();
  let Paths = usePaths();

  let homePath = Paths.home();
  let catalogPath = Paths.catalog();
  let magicMcpRootPath = Paths.magicMcpRoot();
  let magicMcpServerBasePath = Paths.magicMcpServerBase();
  let magicMcpServersPath = Paths.magicMcpServers();
  let magicMcpSessionsPath = Paths.magicMcpSessions();
  let magicMcpTokensPath = Paths.magicMcpTokens();

  let matchesPath = (input: { pathname: string }, to: string, opts?: { exact?: boolean }) => {
    return input.pathname === to || (!opts?.exact && input.pathname.startsWith(`${to}/`));
  };

  useEffect(() => {
    if (!boot.data) return;
    document.title = `${boot.data.portal.name} • Metorial`;
  }, [boot.data]);

  return (
    <AppLayout
      Nav={PortalNav}
      id="portal"
      mainGroups={[
        {
          items: [
            {
              icon: <RiHome6Line />,
              label: 'Home',
              to: homePath,
              getProps: input => ({ isActive: matchesPath(input, homePath, { exact: true }) })
            }
          ]
        },
        {
          label: 'Portal',
          items: [
            {
              icon: <RiGridLine />,
              label: 'Catalog',
              to: catalogPath,
              getProps: input => ({
                isActive:
                  matchesPath(input, catalogPath) || input.pathname.includes('/providers/')
              })
            }
          ]
        },
        {
          label: 'Magic MCP',
          items: [
            {
              icon: <RiFlowChart />,
              label: 'Servers',
              to: magicMcpServersPath,
              getProps: input => ({
                isActive:
                  matchesPath(input, magicMcpServersPath) ||
                  input.pathname === magicMcpRootPath ||
                  input.pathname.startsWith(`${magicMcpServerBasePath}/`)
              })
            },
            {
              icon: <RiFlowChart />,
              label: 'Sessions',
              to: magicMcpSessionsPath,
              getProps: input => ({ isActive: matchesPath(input, magicMcpSessionsPath) })
            },
            {
              icon: <RiKey2Line />,
              label: 'Tokens',
              to: magicMcpTokensPath,
              getProps: input => ({ isActive: matchesPath(input, magicMcpTokensPath) })
            }
          ]
        }
      ]}
    >
      <Outlet />
    </AppLayout>
  );
};
