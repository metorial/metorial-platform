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
  RiFolderSettingsLine,
  RiGroupLine,
  RiHome6Line,
  RiListCheck2,
  RiPlugLine,
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
  let assistantEnabled = !!dashboardFlags.data?.flags['assistant-enabled'];

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
            },
            {
              icon: <RiHome6Line />,
              label: 'Infra',
              to: Paths.instance.infrastructure(...params),
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
              icon: <RiFolderSettingsLine />,
              label: 'Configurations',
              to: Paths.instance.providerAuthConfigs(...params),
              getProps: i => ({
                isActive:
                  checkPath(i) ||
                  checkPathPrefixes(i.pathname, [
                    'configurations/auth-configs',
                    'configurations/auth-config',
                    'configurations/configs',
                    'configurations/config/'
                  ])
              }),
              children: [
                {
                  label: 'Auth Configs',
                  to: Paths.instance.providerAuthConfigs(...params),
                  getProps: i => ({
                    isActive:
                      checkPath(i, { exact: true }) ||
                      checkPathPrefixes(i.pathname, ['configurations/auth-config'])
                  })
                },
                {
                  label: 'Configs',
                  to: Paths.instance.providerConfigs(...params),
                  getProps: i => ({
                    isActive:
                      checkPath(i, { exact: true }) ||
                      checkPathPrefixes(i.pathname, [
                        'configurations/configs',
                        'configurations/config/'
                      ])
                  })
                }
              ]
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
            ...(assistantEnabled
              ? [
                  {
                    icon: <RiChatVoiceAiLine />,
                    label: 'Assistant',
                    to: Paths.instance.assistant(...params),
                    getProps: (i: { pathname: string; to: string }) => ({
                      isActive: checkPath(i)
                    })
                  }
                ]
              : []),

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
