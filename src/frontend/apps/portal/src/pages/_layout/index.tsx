import { AppLayout } from '@metorial/layout/src/applicationLayout/appLayout';
import {
  RiFlowChart,
  RiHome6Line,
  RiServerLine,
  RiSettings2Line,
  RiShieldKeyholeLine,
  RiSurveyLine
} from '@remixicon/react';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useBootWithAuth } from '../../state/portal/client';
import { usePaths } from '../../state/portal/path';
import { PortalNav } from './nav';

export let Layout = () => {
  let boot = useBootWithAuth();
  let Paths = usePaths();

  let checkPath = (
    i: { pathname: string; to: string },
    opts?: { exact?: boolean; exclude?: string[] }
  ) => {
    if (opts?.exclude && opts.exclude.some(e => i.pathname.includes(e))) return false;

    return i.pathname === i.to || (!opts?.exact && i.pathname.startsWith(`${i.to}/`));
  };

  useEffect(() => {
    if (!boot.data) return;
    document.title = `${boot.data.portal.name} • Metorial`;
  }, [boot.data]);

  return (
    <>
      <AppLayout
        Nav={PortalNav}
        id="product"
        mainGroups={[
          {
            items: [
              {
                icon: <RiHome6Line />,
                label: 'Home',
                to: Paths.home(),
                getProps: i => ({ isActive: checkPath(i, { exact: true }) })
              }
            ]
          },

          {
            label: 'Connect',
            collapsible: true,
            items: [
              {
                icon: <RiServerLine />,
                label: 'Servers',
                to: Paths.servers(),
                getProps: i => ({ isActive: checkPath(i, { exact: true }) })
              },

              {
                icon: <RiFlowChart />,
                label: 'Deployments',
                to: Paths.magicMcpServer(),
                getProps: i => ({ isActive: checkPath(i, { exact: true }) }),

                children: [
                  {
                    label: 'Deployments',
                    to: Paths.magicMcpServer(),
                    getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                  },
                  {
                    label: 'Connections',
                    to: Paths.magicMcpSessions(),
                    getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                  }
                ]
              },

              {
                icon: <RiSurveyLine />,
                label: 'Explorer',
                to: Paths.explorer(),
                getProps: i => ({ isActive: checkPath(i, { exact: true }) })
              }
            ]
          },

          {
            label: 'Management',
            collapsible: true,
            items: [
              {
                icon: <RiSettings2Line />,
                label: 'Settings',
                to: Paths.settings(),
                getProps: i => ({ isActive: checkPath(i, { exact: true }) })
              },

              {
                icon: <RiShieldKeyholeLine />,
                label: 'Tokens',
                to: Paths.tokens(),
                getProps: i => ({ isActive: checkPath(i, { exact: true }) })
              }
            ]
          }
        ]}
      >
        <Outlet />
      </AppLayout>
    </>
  );
};
