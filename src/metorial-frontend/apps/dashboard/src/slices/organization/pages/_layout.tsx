import { Paths } from '@metorial/frontend-config';
import { AppLayout, ContentLayout, OssApplicationLayoutNav } from '@metorial/layout';
import { useCurrentOrganization } from '@metorial/state';
import { RiBuilding2Line, RiGroupLine, RiSettings2Line } from '@remixicon/react';
import { Outlet } from 'react-router-dom';

export let OrganizationPageLayout = () => {
  let organization = useCurrentOrganization();

  let o = organization.data;

  let checkPath = (
    i: { pathname: string; to: string },
    opts?: { exact?: boolean; exclude?: string[] }
  ) => {
    if (opts?.exclude && opts.exclude.some(e => i.pathname.includes(e))) return false;
    return i.pathname === i.to || (!opts?.exact && i.pathname.startsWith(`${i.to}/`));
  };

  return (
    <AppLayout
      id="organization"
      Nav={OssApplicationLayoutNav}
      mainGroups={[
        {
          label: 'Organization',
          items: [
            {
              icon: <RiSettings2Line />,
              label: 'General',
              to: Paths.organization.settings(o),

              getProps: i => ({
                isActive: checkPath(i, { exact: true })
              })
            },

            {
              icon: <RiGroupLine />,
              label: 'Team',
              to: Paths.organization.members(o),

              getProps: i => ({
                isActive: checkPath(i)
              })
            },

            {
              icon: <RiBuilding2Line />,
              label: 'Projects',
              to: Paths.organization.projects(o),

              getProps: i => ({
                isActive: checkPath(i, { exact: true })
              })
            }
          ]
        }
      ]}
    >
      <ContentLayout>
        <Outlet />
      </ContentLayout>
    </AppLayout>
  );
};
