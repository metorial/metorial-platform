import {
  Breadcrumbs,
  ExtraHeaderLayout,
  LargePaneLayout,
  SidebarPane
} from '@metorial-io/layout';
import { Logo } from '@metorial-io/ui';
import {
  RiFileList3Line,
  RiGlobalLine,
  RiRefreshLine,
  RiRocketLine,
  RiSearchEyeLine,
  RiTimeLine
} from '@remixicon/react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useSlate } from '../state';

let ContentWrapper = styled.div`
  padding: 20px;
`;

let isPrefixMatch = (pathname: string, to: string): boolean => {
  return pathname === to || pathname.startsWith(to + '/');
};

export let Layout = () => {
  let { pathname } = useLocation();
  let { slateId } = useParams<{ slateId?: string }>();
  let { data: slate } = useSlate(slateId);

  let mainItems = [
    {
      icon: <RiFileList3Line />,
      label: 'Slates',
      to: '/slates',
      isActive: isPrefixMatch(pathname, '/slates') && pathname !== '/slates/redeploy'
    },
    {
      icon: <RiRefreshLine />,
      label: 'Bulk Redeploy',
      to: '/slates/redeploy',
      isActive: pathname === '/slates/redeploy'
    },
    {
      icon: <RiRocketLine />,
      label: 'Deployments',
      to: '/deployments',
      isActive: pathname === '/deployments'
    },
    {
      icon: <RiSearchEyeLine />,
      label: 'Discoveries',
      to: '/discoveries',
      isActive: pathname === '/discoveries'
    },
    {
      icon: <RiTimeLine />,
      label: 'Events',
      to: '/events',
      isActive: pathname === '/events'
    },
    {
      icon: <RiGlobalLine />,
      label: 'Webhooks',
      to: '/webhooks',
      isActive: isPrefixMatch(pathname, '/webhooks')
    }
  ];

  let currentItem = mainItems.find(item => item.isActive);

  let groups = [{ label: 'Navigation', items: mainItems }];

  let breadcrumbs: { label: string; to: string }[] = [];

  if (currentItem) {
    breadcrumbs.push({ label: currentItem.label, to: currentItem.to });
  }

  if (slateId && slate) {
    breadcrumbs = [
      { label: 'Slates', to: '/slates' },
      { label: slate.name || slate.identifier, to: `/slates/${slateId}` }
    ];

    if (pathname.includes('/deployments/')) {
      breadcrumbs.push({ label: 'Deployment', to: pathname });
    }
  }

  let breadcrumbHeader = <Breadcrumbs breadcrumbs={breadcrumbs} />;

  return (
    <LargePaneLayout Nav={AdminNav}>
      <SidebarPane id="main" groups={groups}>
        <ExtraHeaderLayout header={breadcrumbHeader}>
          <ContentWrapper>
            <Outlet />
          </ContentWrapper>
        </ExtraHeaderLayout>
      </SidebarPane>
    </LargePaneLayout>
  );
};

let NavWrapper = styled.header`
  padding: 5px 15px 5px 5px;
`;

let NavContent = styled.nav`
  display: flex;
  align-items: center;
  height: 50px;
  gap: 10px;
  color: #222;

  h1 {
    font-size: 18px;
    margin: 0;
  }
`;

export let AdminNav = () => {
  return (
    <NavWrapper>
      <NavContent>
        <Logo size={30} />
        <h1>Slates Hub Admin</h1>
      </NavContent>
    </NavWrapper>
  );
};
