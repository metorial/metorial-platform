import { Paths } from '@metorial/frontend-config';
import { AppLayout } from '@metorial/layout';
import { useCurrentOrganization, useCurrentProject } from '@metorial/state';
import { RiHomeLine, RiSettings2Line, RiTerminalBoxLine } from '@remixicon/react';
import { Outlet } from 'react-router-dom';

export let ProjectPageLayout = () => {
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let checkPath = (
    i: { pathname: string; to: string },
    opts?: { exact?: boolean; exclude?: string[] }
  ) => {
    if (opts?.exclude && opts.exclude.some(e => i.pathname.includes(e))) return false;

    return i.pathname === i.to || (!opts?.exact && i.pathname.startsWith(`${i.to}/`));
  };

  return (
    <AppLayout
      id="product"
      mainGroups={[
        {
          items: [
            {
              icon: <RiHomeLine />,
              label: 'Home',
              to: Paths.project(organization.data, project.data),

              getProps: i => ({
                isActive: checkPath(i, { exact: true })
              })
            }
          ]
        },

        {
          label: 'Management',
          collapsible: true,
          items: [
            {
              icon: <RiTerminalBoxLine />,
              label: 'Developer',
              to: Paths.project.developer(organization.data, project.data),

              children: [
                {
                  label: 'API Keys',
                  to: Paths.project.developer(organization.data, project.data),

                  getProps: i => ({
                    isActive: checkPath(i, { exact: true })
                  })
                },
                {
                  label: 'Environments',
                  to: Paths.project.developer(organization.data, project.data, 'environments'),

                  getProps: i => ({
                    isActive: checkPath(i)
                  })
                },
                {
                  label: 'API Access',
                  to: Paths.project.developer(organization.data, project.data, 'api'),

                  getProps: i => ({
                    isActive: checkPath(i)
                  })
                }
              ]
            },

            {
              icon: <RiSettings2Line />,
              label: 'Settings',
              to: Paths.project.settings(organization.data, project.data),

              children: [
                {
                  label: 'Project',
                  to: Paths.project.settings(organization.data, project.data),

                  getProps: i => ({
                    isActive: checkPath(i, { exact: true })
                  })
                },
                {
                  label: 'Organization',
                  to: Paths.organization.settings(organization.data)
                },
                {
                  label: 'Team',
                  to: Paths.organization.members(organization.data)
                }
              ]
            }
          ]
        }
      ]}
    >
      <Outlet />
    </AppLayout>
  );
};
