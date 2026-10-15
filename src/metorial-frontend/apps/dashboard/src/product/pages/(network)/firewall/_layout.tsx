import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useFirewall
} from '@metorial/state';
import { RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiShieldKeyholeLine } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';
import { NetworkManagedPage } from '../_gate';

let FirewallDetailsLayout = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { firewallId } = useParams();
  let firewall = useFirewall(instance.data?.id, firewallId);
  let params = [organization.data, project.data, instance.data] as const;

  return (
    <DetailsLayout
      entity={firewall.data}
      icon={<RiShieldKeyholeLine />}
      breadcrumbs={[
        { label: 'Firewalls', to: Paths.instance.networkFirewalls(...params) },
        {
          label: firewall.data?.name,
          to: Paths.instance.networkFirewall(...params, firewallId)
        }
      ]}
      tabs={[
        { label: 'Overview', to: Paths.instance.networkFirewall(...params, firewallId) },
        {
          label: 'Settings',
          to: Paths.instance.networkFirewall(...params, firewallId, 'settings')
        }
      ]}
      attributes={
        firewall.data
          ? [
              { label: 'ID', value: <ID id={firewall.data.id} /> },
              { label: 'Created', value: <RenderDate date={firewall.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ firewall })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};

export let NetworkFirewallPageLayout = () => (
  <NetworkManagedPage fallbackWithLayout>
    <FirewallDetailsLayout />
  </NetworkManagedPage>
);
