import { ExtraHeaderLayout, LargePaneLayout, SidebarPane } from '@metorial-io/layout';
import { Logo, ModalRoot, Toaster } from '@metorial-io/ui';
import { RiApps2Line, RiFileListLine, RiGroupLine, RiSettings3Line, RiShieldUserLine, RiUserLine } from '@remixicon/react';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';

export let Layout = () => {
  let { pathname } = useLocation();

  let accountItems = [
    { icon: <RiUserLine />, label: 'Users', to: '/users' },
    { icon: <RiShieldUserLine />, label: 'Admins', to: '/admins' },
    { icon: <RiFileListLine />, label: 'Audit Logs', to: '/audit-logs' }
  ];

  let configItems = [
    { icon: <RiApps2Line />, label: 'Apps', to: '/apps' },
    { icon: <RiGroupLine />, label: 'Tenants', to: '/tenants' },
    { icon: <RiSettings3Line />, label: 'Settings', to: '/settings' }
  ];

  let items = [...accountItems, ...configItems];

  let currentItem = items.find(i => pathname.startsWith(i.to));

  return (
    <div style={{ background: '#efefff' }}>
      <LargePaneLayout Nav={AdminNav}>
        <SidebarPane
          id="admin"
          groups={[
            {
              label: 'Account',
              items: accountItems
            },
            {
              label: 'Configuration',
              items: configItems
            }
          ]}
        >
          <ExtraHeaderLayout
            header={
              <div style={{ fontWeight: 'bold' }}>{currentItem?.label ?? 'Metorial Auth'}</div>
            }
          >
            <div style={{ padding: 20 }}>
              <Outlet />
            </div>
          </ExtraHeaderLayout>
        </SidebarPane>
      </LargePaneLayout>
      <Toaster />
      <ModalRoot />
    </div>
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
      <Inner style={{ gridTemplateColumns: '1fr 1fr' }}>
        <LogoPart>
          <Logo size={30} />
          <h1>
            <span>Metorial Auth</span>
          </h1>
        </LogoPart>
      </Inner>
    </Wrapper>
  );
};
