import { Paths } from '@metorial/frontend-config';
import type { EntityParam } from '@metorial/frontend-config';
import { AppLayout, OssApplicationLayoutNav } from '@metorial/layout';
import {
  lastInstanceIdStore,
  useCurrentInstance,
  useCurrentOrganization
} from '@metorial/state';
import {
  RiBriefcase4Line,
  RiChatVoiceAiLine,
  RiFileList3Line,
  RiFlowChart,
  RiFunctionLine,
  RiGroupLine,
  RiHome6Line,
  RiListCheck2,
  RiPlugLine,
  RiRfidLine,
  RiSettings2Line,
  RiShieldKeyholeLine,
  RiSurveyLine,
  RiUploadCloud2Line,
  RiWebhookLine
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

  let params = [organization.data, instance.data?.project, instance.data] as [
    EntityParam,
    EntityParam,
    EntityParam
  ];

  return (
    <AppLayout
      Nav={() => <OssApplicationLayoutNav />}
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
              icon: <RiPlugLine />,
              label: 'Providers',
              to: Paths.instance.providers(...params),
              getProps: i => ({ isActive: checkPath(i, { exclude: ['configurations'] }) })
            },

            {
              icon: <RiFlowChart />,
              label: 'Configurations',
              to: Paths.instance.providerDeployments(...params),
              getProps: i => ({ isActive: checkPath(i) }),
              children: [
                {
                  label: 'Deployments',
                  to: Paths.instance.providerDeployments(...params),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                },
                {
                  label: 'Configs',
                  to: Paths.instance.providerDeployments(...params, 'configs'),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                },
                {
                  label: 'Vaults',
                  to: Paths.instance.providerDeployments(...params, 'config-vaults'),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                },
                {
                  label: 'Auth Credentials',
                  to: Paths.instance.providerDeployments(...params, 'auth-credentials'),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                },
                {
                  label: 'Auth Configs',
                  to: Paths.instance.providerDeployments(...params, 'auth-configs'),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                }
              ]
            },

            {
              icon: <RiFileList3Line />,
              label: 'Templates',
              to: Paths.instance.sessionTemplates(...params),
              getProps: i => ({ isActive: checkPath(i) })
            },

            {
              icon: <RiListCheck2 />,
              label: 'Logs',
              to: Paths.instance.providerSessions(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) }),

              children: [
                {
                  label: 'Sessions',
                  to: Paths.instance.providerSessions(...params),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                },
                {
                  label: 'Provider Runs',
                  to: Paths.instance.providerRuns(...params),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                },
                {
                  label: 'Errors',
                  to: Paths.instance.providerErrors(...params),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                }
              ]
            },

            {
              icon: <RiSurveyLine />,
              label: 'Explorer',
              to: Paths.instance.explorer(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },

            {
              icon: <RiWebhookLine />,
              label: 'Magic MCP',
              to: Paths.instance.magicMcp.providers(...params),
              getProps: i => ({ isActive: i.pathname.includes('/magic-mcp/') })
            },

            // {
            //   icon: <RiWebhookLine />,
            //   label: 'Callbacks',
            //   to: Paths.instance.callbacks(...params),
            //   getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            // }
          ]
        },

        {
          label: 'Gateway',
          collapsible: true,
          items: [
            {
              icon: <RiUploadCloud2Line />,
              label: 'External Providers',
              to: Paths.instance.externalProviders(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },
            {
              icon: <RiChatVoiceAiLine />,
              label: 'Custom Providers',
              to: Paths.instance.customProviders(...params),
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
