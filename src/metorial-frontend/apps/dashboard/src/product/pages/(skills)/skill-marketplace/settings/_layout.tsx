import { Paths } from '@metorial/frontend-config';
import { SidebarLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillMarketplace
} from '@metorial/state';
import { RiGroupLine, RiSettings3Line } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';

export let SkillMarketplaceSettingsLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillMarketplaceId } = useParams();
  let marketplace = useSkillMarketplace(instance.data?.id, skillMarketplaceId);

  let settingsPath = (...subPages: string[]) =>
    Paths.instance.skillMarketplace(
      organization.data,
      project.data,
      instance.data,
      marketplace.data?.id ?? skillMarketplaceId,
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
      id="skill-marketplace-settings"
      groups={[
        {
          label: '',
          items: [
            navItem(<RiSettings3Line />, 'General'),
            navItem(<RiGroupLine />, 'Managers & Access', 'access')
          ]
        }
      ]}
    >
      <Outlet />
    </SidebarLayout>
  );
};
