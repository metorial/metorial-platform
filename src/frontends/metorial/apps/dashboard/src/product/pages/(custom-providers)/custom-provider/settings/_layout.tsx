import { Paths } from '@metorial/frontend-config';
import { SidebarLayout } from '@metorial/layout';
import { useCurrentInstance, useCurrentOrganization, useCurrentProject } from '@metorial/state';
import { RiSettings3Line, RiStore2Line } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';

export let CustomProviderSettingsLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { customProviderId } = useParams();

  let settingsPath = (...subPages: string[]) =>
    Paths.instance.customProvider(
      organization.data,
      project.data,
      instance.data,
      customProviderId,
      'settings',
      ...subPages
    );

  let navItem = (icon: React.ReactNode, label: string, ...subPages: string[]) => {
    let to = settingsPath(...subPages);

    return {
      icon,
      label,
      to,
      getProps: (i: { pathname: string }) => ({ isActive: i.pathname === to })
    };
  };

  return (
    <SidebarLayout
      id="custom-provider-settings"
      groups={[
        {
          label: '',
          items: [
            navItem(<RiSettings3Line />, 'General'),
            navItem(<RiStore2Line />, 'Listing', 'listing')
          ]
        }
      ]}
    >
      <Outlet />
    </SidebarLayout>
  );
};
