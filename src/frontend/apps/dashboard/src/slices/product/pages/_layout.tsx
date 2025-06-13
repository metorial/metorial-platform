import { Paths } from '@metorial/frontend-config';
import { AppLayout } from '@metorial/layout';
import { useCurrentInstance, useCurrentOrganization } from '@metorial/state';
import { RiHomeLine, RiSettings2Line, RiTerminalBoxLine } from '@remixicon/react';
import { Outlet } from 'react-router-dom';

// @ts-ignore
import { Helmet } from 'react-helmet';

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

  return (
    <AppLayout
      id="product"
      mainGroups={[
        {
          items: [
            {
              icon: <RiHomeLine />,
              label: 'Home',
              to: Paths.instance(organization.data, instance.data?.project, instance.data),

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
              to: Paths.instance.developer(
                organization.data,
                instance.data?.project,
                instance.data
              ),

              children: [
                {
                  label: 'API Keys',
                  to: Paths.instance.developer(
                    organization.data,
                    instance.data?.project,
                    instance.data
                  ),

                  getProps: i => ({
                    isActive: checkPath(i, { exact: true })
                  })
                },
                {
                  label: 'Environments',
                  to: Paths.instance.developer(
                    organization.data,
                    instance.data?.project,
                    instance.data,
                    'environments'
                  ),

                  getProps: i => ({
                    isActive: checkPath(i)
                  })
                },
                {
                  label: 'API Access',
                  to: Paths.instance.developer(
                    organization.data,
                    instance.data?.project,
                    instance.data,
                    'api'
                  ),

                  getProps: i => ({
                    isActive: checkPath(i)
                  })
                }
              ]
            },

            {
              icon: <RiSettings2Line />,
              label: 'Settings',
              to: Paths.instance.settings(
                organization.data,
                instance.data?.project,
                instance.data
              ),

              children: [
                {
                  label: 'Project',
                  to: Paths.instance.settings(
                    organization.data,
                    instance.data?.project,
                    instance.data
                  ),

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
      {instance.data && (
        <Helmet>
          <title>Metorial Dashboard • {instance.data.project.name}</title>
        </Helmet>
      )}

      <Outlet />
    </AppLayout>
  );
};
