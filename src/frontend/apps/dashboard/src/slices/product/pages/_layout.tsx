import { Paths } from '@metorial/frontend-config';
import { AppLayout } from '@metorial/layout';
import { useCurrentInstance, useCurrentOrganization } from '@metorial/state';
import { RiHomeLine, RiSettings2Line, RiTerminalBoxLine } from '@remixicon/react';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

export let ProjectPageLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();

  let checkPath = (
    i: { pathname: string; to: string },
    opts?: { exact?: boolean; exclude?: string[] }
  ) => {
    if (opts?.exclude && opts.exclude.some(e => i.pathname.includes(e))) return false;

    return i.pathname === i.to || (!opts?.exact && i.pathname.startsWith(`${i.to}/`));
  };

  useEffect(() => {
    if (!instance.data) return;
    document.title = `${instance.data.project.name} • Metorial Dashboard`;
  }, [instance.data]);

  let pathParts = [organization.data, instance.data?.project, instance.data] as const;

  return (
    <AppLayout
      id="product"
      mainGroups={[
        {
          items: [
            {
              icon: <RiHomeLine />,
              label: 'Home',
              to: Paths.instance(...pathParts),

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
              to: Paths.instance.developer(...pathParts),

              children: [
                {
                  label: 'API Keys',
                  to: Paths.instance.developer(...pathParts),

                  getProps: i => ({
                    isActive: checkPath(i, { exact: true })
                  })
                },
                {
                  label: 'Environments',
                  to: Paths.instance.developer(...pathParts, 'environments'),

                  getProps: i => ({
                    isActive: checkPath(i)
                  })
                },
                {
                  label: 'API Access',
                  to: Paths.instance.developer(...pathParts, 'api'),

                  getProps: i => ({
                    isActive: checkPath(i)
                  })
                }
              ]
            },

            {
              icon: <RiSettings2Line />,
              label: 'Settings',
              to: Paths.instance.settings(...pathParts),

              children: [
                {
                  label: 'Project',
                  to: Paths.instance.settings(...pathParts),

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
