import type { EntityParam } from '@metorial/frontend-config';
import { Paths } from '@metorial/frontend-config';
import { AppLayout, OssApplicationLayoutNav } from '@metorial/layout';
import {
  lastInstanceIdStore,
  useCurrentInstance,
  useCurrentOrganization,
  useDashboardFlags
} from '@metorial/state';
import {
  RiBriefcase4Line,
  RiChatVoiceAiLine,
  RiFileList3Line,
  RiFlowChart,
  RiFolderSettingsLine,
  RiFunctionLine,
  RiGroupLine,
  RiHome6Line,
  RiKey2Line,
  RiListCheck2,
  RiPlugLine,
  RiRfidLine,
  RiServerLine,
  RiSettings2Line,
  RiShieldKeyholeLine,
  RiSurveyLine,
  RiUploadCloud2Line,
  RiUser3Line,
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
  let checkPathPrefixes = (pathname: string, prefixes: string[]) =>
    prefixes.some(prefix => pathname.includes(`/${prefix}`));
  let checkProviderDeploymentDetailPath = (pathname: string) => {
    let marker = '/configurations/';
    let markerIndex = pathname.indexOf(marker);
    if (markerIndex === -1) return false;

    let relativePath = pathname.slice(markerIndex + 1);

    return ![
      'configurations/auth-credentials',
      'configurations/auth-credential',
      'configurations/auth-configs',
      'configurations/auth-config',
      'configurations/configs',
      'configurations/config',
      'configurations/config-vaults'
    ].some(prefix => relativePath === prefix || relativePath.startsWith(`${prefix}/`));
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
  let dashboardFlags = useDashboardFlags();
  let networkingEnabled = !!dashboardFlags.data?.flags['networking-enabled'];

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
              icon: <RiKey2Line />,
              label: 'Auth Credentials',
              to: Paths.instance.providerDeployments(...params, 'auth-credentials'),
              getProps: i => ({
                isActive:
                  checkPath(i, { exact: true }) ||
                  i.pathname.includes('/configurations/auth-credential/')
              })
            },

            {
              icon: <RiFlowChart />,
              label: 'Deployments',
              to: Paths.instance.providerDeployments(...params),
              getProps: i => ({
                isActive:
                  checkPath(i, { exact: true }) || checkProviderDeploymentDetailPath(i.pathname)
              })
            },

            {
              icon: <RiFolderSettingsLine />,
              label: 'Configurations',
              to: Paths.instance.providerDeployments(...params, 'auth-configs'),
              getProps: i => ({
                isActive:
                  checkPath(i) ||
                  checkPathPrefixes(i.pathname, [
                    'configurations/auth-configs',
                    'configurations/auth-config',
                    'configurations/configs',
                    'configurations/config',
                    'configurations/config-vaults',
                    'provider-config-vault'
                  ])
              }),
              children: [
                {
                  label: 'Auth Configs',
                  to: Paths.instance.providerDeployments(...params, 'auth-configs'),
                  getProps: i => ({
                    isActive:
                      checkPath(i, { exact: true }) ||
                      checkPathPrefixes(i.pathname, ['configurations/auth-config'])
                  })
                },
                {
                  label: 'Configs',
                  to: Paths.instance.providerDeployments(...params, 'configs'),
                  getProps: i => ({
                    isActive:
                      checkPath(i, { exact: true }) ||
                      checkPathPrefixes(i.pathname, ['configurations/config'])
                  })
                },
                {
                  label: 'Vaults',
                  to: Paths.instance.providerDeployments(...params, 'config-vaults'),
                  getProps: i => ({
                    isActive:
                      checkPath(i, { exact: true }) ||
                      checkPathPrefixes(i.pathname, ['provider-config-vault'])
                  })
                }
              ]
            },

            {
              icon: <RiFileList3Line />,
              label: 'Templates',
              to: Paths.instance.sessionTemplates(...params),
              getProps: i => ({
                isActive: checkPath(i) || checkPathPrefixes(i.pathname, ['session-template'])
              })
            },

            {
              icon: <RiListCheck2 />,
              label: 'Monitoring',
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
              icon: <RiChatVoiceAiLine />,
              label: 'Assistant',
              to: Paths.instance.assistant(...params),
              getProps: i => ({ isActive: checkPath(i) })
            },

            {
              icon: <RiWebhookLine />,
              label: 'Magic MCP',
              to: Paths.instance.magicMcp.servers(...params),
              getProps: i => ({ isActive: i.pathname.includes('/magic-mcp/') })
            },
            {
              icon: <RiWebhookLine />,
              label: 'Callbacks',
              to: Paths.instance.callbacks(...params),
              getProps: i => ({
                isActive:
                  i.pathname === Paths.instance.callbacks(...params) ||
                  i.pathname.includes('/callbacks/') ||
                  i.pathname.includes('/callback/')
              })
            }
          ]
        },

        ...(networkingEnabled ?
          [
            {
              label: 'Compute',
              collapsible: true,
              items: [
                {
                  icon: <RiShieldKeyholeLine />,
                  label: 'Overview',
                  to: Paths.instance.security(...params),
                  getProps: (i: { pathname: string; to: string }) => ({
                    isActive: checkPath(i, { exact: true })
                  })
                },
                {
                  icon: <RiFlowChart />,
                  label: 'Network',
                  to: Paths.instance.network(...params),
                  getProps: (i: { pathname: string; to: string }) => ({
                    isActive:
                      checkPath(i, { exact: true }) ||
                      i.pathname.includes('/network/firewall/')
                  }),
                  children: [
                    {
                      label: 'Firewalls',
                      to: Paths.instance.networkFirewalls(...params),
                      getProps: (i: { pathname: string; to: string }) => ({
                        isActive:
                          checkPath(i, { exact: true }) ||
                          i.pathname.includes('/network/firewall/')
                      })
                    },
                    {
                      label: 'Network Settings',
                      to: Paths.instance.networkSettings(...params),
                      getProps: (i: { pathname: string; to: string }) => ({
                        isActive: checkPath(i, { exact: true })
                      })
                    }
                  ]
                },
                {
                  icon: <RiServerLine />,
                  label: 'Enclaves',
                  to: Paths.instance.networkEnclaves(...params),
                  getProps: (i: { pathname: string; to: string }) => ({
                    isActive: checkPath(i, { exact: true })
                  })
                }
              ]
            }
          ]
        : []),

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
          label: 'Identity',
          collapsible: true,
          items: [
            {
              icon: <RiUser3Line />,
              label: 'Accounts',
              to: Paths.instance.identity.consumers(...params),
              getProps: i => ({
                isActive: checkPath(i) || i.pathname.includes('/identity/consumer/')
              })
            }
          ]
        },

        {
          label: 'Settings',
          collapsible: true,
          items: [
            {
              icon: <RiBriefcase4Line />,
              label: 'Organization',
              to: Paths.organization.settings(organization.data),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },

            {
              icon: <RiSettings2Line />,
              label: 'Project',
              to: Paths.project.settings(organization.data, instance.data?.project),
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
