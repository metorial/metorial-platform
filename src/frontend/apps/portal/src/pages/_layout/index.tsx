import { AppLayout } from '@metorial/layout';
import { Logo } from '@metorial/ui';
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
import styled from 'styled-components';
import { useBoot } from '../../state/portal/client';
import { usePaths } from '../../state/portal/path';

export let Layout = () => {
  let boot = useBoot();
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
        Nav={AdminNav}
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
                label: 'Token',
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

let Wrapper = styled.header`
  padding: 5px 15px 5px 5px;
`;

let Inner = styled.nav`
  display: grid;
  gap: 15px;
  height: 50px;
`;

let Part = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
`;

let LogoPart = styled(Part)`
  justify-content: flex-start;
  color: #222;

  h1 {
    font-size: 18px;
    margin-left: 10px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
`;

export let AdminNav = () => {
  return (
    <Wrapper>
      <Inner
        style={{
          gridTemplateColumns: '1fr  1fr'
        }}
      >
        <LogoPart>
          <Logo size={30} />

          <h1>
            <span>Metorial</span>
            <span>
              <u>A</u>utomated <u>D</u>eterministic <u>M</u>odel <u>I</u>
              nference <u>N</u>ode
            </span>
          </h1>
        </LogoPart>
      </Inner>
    </Wrapper>
  );
};
