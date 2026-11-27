import { Paths } from '@metorial/frontend-config';
import { SidebarLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEventDestination
} from '@metorial/state';
import { RiListCheck3, RiSettings3Line } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';

export let EventDestinationSettingsLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { eventDestinationId } = useParams();
  let destination = useEventDestination(organization.data?.id, eventDestinationId);

  let settingsPath = (...subPages: string[]) =>
    Paths.instance.eventDestinationSettings(
      organization.data,
      project.data,
      instance.data,
      destination.data?.id ?? eventDestinationId,
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
      id="event-destination-settings"
      groups={[
        {
          label: '',
          items: [
            navItem(<RiSettings3Line />, 'General'),
            navItem(<RiListCheck3 />, 'Listeners', 'listeners')
          ]
        }
      ]}
    >
      <Outlet />
    </SidebarLayout>
  );
};
