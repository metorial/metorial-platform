import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useFirewall
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let NetworkFirewallPageLayout = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let location = useLocation();
  let { firewallId } = useParams();
  let firewall = useFirewall(instance.data?.id, firewallId);

  return (
    <ContentLayout>
      {renderWithLoader({ firewall })(({ firewall }) => (
        <>
          <PageHeader
            title={firewall.data.name}
            description="Manage this firewall's network policies and settings."
            pagination={[
              {
                label: 'Firewalls',
                href: Paths.instance.networkFirewalls(
                  organization.data,
                  project.data,
                  instance.data
                )
              },
              {
                label: firewall.data.name,
                href: Paths.instance.networkFirewall(
                  organization.data,
                  project.data,
                  instance.data,
                  firewall.data.id
                )
              }
            ]}
          />

          <LinkTabs
            current={location.pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.networkFirewall(
                  organization.data,
                  project.data,
                  instance.data,
                  firewall.data.id
                )
              },
              {
                label: 'Settings',
                to: Paths.instance.networkFirewall(
                  organization.data,
                  project.data,
                  instance.data,
                  firewall.data.id,
                  'settings'
                )
              }
            ]}
          />

          <InitialLoadBoundary>
            <Outlet />
          </InitialLoadBoundary>
        </>
      ))}
    </ContentLayout>
  );
};
