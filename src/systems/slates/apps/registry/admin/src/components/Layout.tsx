import { Breadcrumbs, ExtraHeaderLayout, LargePaneLayout, SidebarPane } from '@metorial/layout';
import { Logo } from '@metorial/ui';
import {
  RiApps2Line,
  RiBuildingLine,
  RiDashboardLine,
  RiFileList3Line,
  RiStackLine,
  RiUserLine
} from '@remixicon/react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../hooks';

let ContentWrapper = styled.div`
  padding: 20px;
`;

let isExactMatch = (pathname: string, to: string): boolean => {
  return pathname === to;
};

let isPrefixMatch = (pathname: string, to: string): boolean => {
  return pathname === to || pathname.startsWith(to + '/');
};

export let Layout = () => {
  let { isLoading } = useAuth();
  let { pathname } = useLocation();
  let { tenantId } = useParams<{ tenantId?: string }>();
  let { data: tenant } = useTenant(tenantId ?? '');

  if (isLoading) {
    return null;
  }

  let isOnTenantPage = pathname.startsWith('/tenants') && tenantId;

  let mainItems = [
    {
      icon: <RiBuildingLine />,
      label: 'Tenants',
      to: '/tenants',
      isActive: pathname === '/tenants' || pathname === '/tenants/new'
    }
  ];

  let tenantItems = tenantId
    ? [
        {
          icon: <RiDashboardLine />,
          label: 'Overview',
          to: `/tenants/${tenantId}`,
          isActive: isExactMatch(pathname, `/tenants/${tenantId}`)
        },
        {
          icon: <RiStackLine />,
          label: 'Sub-Registries',
          to: `/tenants/${tenantId}/sub-registries`,
          isActive: isPrefixMatch(pathname, `/tenants/${tenantId}/sub-registries`)
        },
        {
          icon: <RiApps2Line />,
          label: 'Workspaces',
          to: `/tenants/${tenantId}/workspaces`,
          isActive: isPrefixMatch(pathname, `/tenants/${tenantId}/workspaces`)
        },
        {
          icon: <RiUserLine />,
          label: 'Users',
          to: `/tenants/${tenantId}/users`,
          isActive: isPrefixMatch(pathname, `/tenants/${tenantId}/users`)
        },
        {
          icon: <RiFileList3Line />,
          label: 'Slates',
          to: `/tenants/${tenantId}/slates`,
          isActive: isPrefixMatch(pathname, `/tenants/${tenantId}/slates`)
        }
      ]
    : [];

  let allItems = [...mainItems, ...tenantItems];
  let currentItem = allItems.find(item => item.isActive);

  let groups = [{ label: 'Navigation', items: mainItems }];

  if (isOnTenantPage && tenant) {
    groups.push({
      label: tenant.name,
      items: tenantItems
    });
  }

  let breadcrumbs: { label: string; to: string }[] = [{ label: 'Tenants', to: '/tenants' }];

  if (isOnTenantPage && tenant) {
    breadcrumbs.push({ label: tenant.name, to: `/tenants/${tenantId}` });
    if (currentItem && currentItem.label !== 'Overview') {
      breadcrumbs.push({ label: currentItem.label, to: currentItem.to });
    }
  } else if (currentItem) {
    breadcrumbs.push({ label: currentItem.label, to: currentItem.to });
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
        <h1>Slates Registry Admin</h1>
      </NavContent>
    </NavWrapper>
  );
};
