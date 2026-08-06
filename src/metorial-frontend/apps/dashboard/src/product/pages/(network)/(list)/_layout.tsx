import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { Outlet, useLocation } from 'react-router-dom';
import { NetworkManagedPage } from '../_gate';

export let NetworkListLayout = () => {
  let location = useLocation();
  let isFirewallsPage = location.pathname.endsWith('/firewalls');
  let isSettingsPage = location.pathname.endsWith('/settings');
  let title = isFirewallsPage ? 'Firewalls' : isSettingsPage ? 'Network Settings' : 'Network';
  let description = isFirewallsPage
    ? 'Manage network firewalls and their policies.'
    : isSettingsPage
      ? 'Manage the default network and its firewall bindings.'
      : 'Monitor network activity and connections for this instance.';

  return (
    <ContentLayout>
      <PageHeader title={title} description={description} />

      <NetworkManagedPage>
        <PaginationSearchParamsProvider enabled={true}>
          <Outlet />
        </PaginationSearchParamsProvider>
      </NetworkManagedPage>
    </ContentLayout>
  );
};

export let NetworkEnclavesListLayout = () => {
  return (
    <ContentLayout>
      <PageHeader
        title="Enclaves"
        description="Inspect provider deployment enclaves and their recent network usage."
      />

      <NetworkManagedPage>
        <PaginationSearchParamsProvider enabled={true}>
          <Outlet />
        </PaginationSearchParamsProvider>
      </NetworkManagedPage>
    </ContentLayout>
  );
};
