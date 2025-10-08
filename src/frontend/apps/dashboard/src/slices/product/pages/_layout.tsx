import { Paths } from '@metorial/frontend-config';
import { AppLayout } from '@metorial/layout';
import {
  lastInstanceIdStore,
  useCurrentInstance,
  useCurrentOrganization
} from '@metorial/state';
import {
  RiArrowLeftRightLine,
  RiBriefcase4Line,
  RiFlowChart,
  RiFunctionLine,
  RiGroupLine,
  RiHome6Line,
  RiListCheck2,
  RiRfidLine,
  RiServerLine,
  RiSettings2Line,
  RiShieldKeyholeLine,
  RiSurveyLine,
  RiUploadCloud2Line
} from '@remixicon/react';
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

  useEffect(() => {
    if (!instance.data) return;
    lastInstanceIdStore.set(instance.data.id);
  }, [instance.data]);

  let params = [organization.data, instance.data?.project, instance.data] as const;

  return (
    <AppLayout
      id="product"
      mainGroups={[
        {
          items: [
            {
              icon: <RiHome6Line />,
              label: 'Home',
              to: Paths.instance(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            }
          ]
        },

        {
          label: 'Connect',
          collapsible: true,
          items: [
            {
              icon: <RiServerLine />,
              label: 'Servers',
              to: Paths.instance.servers(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },

            {
              icon: <RiFlowChart />,
              label: 'Deployments',
              to: Paths.instance.serverDeployments(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) }),

              children: [
                {
                  label: 'Deployments',
                  to: Paths.instance.serverDeployments(...params),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                },
                {
                  label: 'Implementations',
                  to: Paths.instance.serverImplementations(...params),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                }
              ]
            },

            {
              icon: <RiListCheck2 />,
              label: 'Logs',
              to: Paths.instance.sessions(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) }),

              children: [
                {
                  label: 'Sessions',
                  to: Paths.instance.sessions(...params),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                },
                {
                  label: 'Server Runs',
                  to: Paths.instance.serverRuns(...params),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                },
                {
                  label: 'Errors',
                  to: Paths.instance.serverErrors(...params),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                }
              ]
            },

            {
              icon: <RiSurveyLine />,
              label: 'Explorer',
              to: Paths.instance.explorer(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            }
          ]
        },

        {
          label: 'Gateway',
          collapsible: true,
          items: [
            {
              icon: <RiUploadCloud2Line />,
              label: 'External Servers',
              to: Paths.instance.externalServers(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },
            {
              icon: <RiArrowLeftRightLine />,
              label: 'OAuth Connections',
              to: Paths.instance.providerConnections(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            }
          ]
        },

        {
          label: 'Developer',
          collapsible: true,
          items: [
            {
              icon: <RiShieldKeyholeLine />,
              label: 'API Keys',
              to: Paths.instance.developer(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },
            {
              icon: <RiFunctionLine />,
              label: 'Instances',
              to: Paths.instance.developer(...params, 'environments'),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },
            {
              icon: <RiRfidLine />,
              label: 'API Access',
              to: Paths.instance.developer(...params, 'api'),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            }
          ]
        },

        {
          label: 'Management',
          collapsible: true,
          items: [
            {
              icon: <RiSettings2Line />,
              label: 'Settings',
              to: Paths.instance.settings(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },

            {
              icon: <RiBriefcase4Line />,
              label: 'Organization',
              to: Paths.organization.settings(organization.data),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },

            {
              icon: <RiGroupLine />,
              label: 'Team',
              to: Paths.organization.members(organization.data),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            }
          ]
        }
      ]}
    >
      <Outlet />
    </AppLayout>
  );
};
