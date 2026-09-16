import type { EntityParam } from '@metorial/frontend-config';
import { Paths } from '@metorial/frontend-config';
import { AppLayout, OssApplicationLayoutNav } from '@metorial/layout';
import {
  lastInstanceIdStore,
  useCurrentInstance,
  useCurrentOrganization,
  useDashboardFlags,
  useHasCallbacks
} from '@metorial/state';
import {
  RiBriefcase4Line,
  RiChat3Line,
  RiChatVoiceAiLine,
  RiFileCopyLine,
  RiFolderLine,
  RiGroupLine,
  RiHome6Line,
  RiListCheck2,
  RiPlugLine,
  RiRssLine,
  RiSparkling2Line,
  RiStore2Line,
  RiCompassDiscoverLine,
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
  let dashboardFlags = useDashboardFlags();
  let skillsEnabled = !!dashboardFlags.data?.flags['skills-enabled'];
  let callbacksEnabled = !!dashboardFlags.data?.flags['callbacks-enabled'];
  let webhooksEnabled = !!dashboardFlags.data?.flags['webhooks-enabled'];
  let chatEnabled = !!dashboardFlags.data?.flags['chat-enabled'];
  let hasCallbacks = useHasCallbacks(callbacksEnabled ? instance.data?.id : null).hasCallbacks;

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
              to: Paths.instance.home(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },
            {
              icon: <RiPlugLine />,
              label: 'Integrations',
              to: Paths.instance.integrationsOverview(...params),
              getProps: i => ({ isActive: checkPath(i, { exact: true }) })
            },
            {
              icon: <RiCompassDiscoverLine />,
              label: 'Explorer',
              to: Paths.instance.explorer(...params),
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
                  label: 'Tool Errors',
                  to: Paths.instance.providerErrors(...params),
                  getProps: i => ({ isActive: checkPath(i, { exact: true }) })
                }
              ]
            },

            {
              icon: <RiWebhookLine />,
              label: 'Magic MCP',
              to: Paths.instance.magicMcp.servers(...params),
              getProps: i => ({ isActive: i.pathname.includes('/magic-mcp/') })
            }
          ]
        },

        ...(chatEnabled
          ? [
              {
                label: 'Chat',
                collapsible: true,
                items: [
                  {
                    icon: <RiChat3Line />,
                    label: 'Connections',
                    to: Paths.instance.chatConnections(...params),
                    getProps: (i: { pathname: string; to: string }) => ({
                      isActive: checkPath(i, { exact: true })
                    })
                  }
                ]
              }
            ]
          : []),

        ...(callbacksEnabled
          ? [
              {
                label: 'Callbacks',
                collapsible: true,
                items: [
                  {
                    icon: <RiRssLine />,
                    label: 'Callbacks',
                    to: Paths.instance.callbacks(...params),
                    getProps: (i: { pathname: string; to: string }) => ({
                      isActive: checkPath(i, { exact: true })
                    }),

                    children: [
                      {
                        label: 'Callbacks',
                        to: Paths.instance.callbacks(...params),
                        getProps: (i: { pathname: string; to: string }) => ({
                          isActive: checkPath(i, { exact: true })
                        })
                      },
                      {
                        label: 'Webhook Receivers',
                        to: Paths.instance.webhookRegistrations(...params),
                        getProps: (i: { pathname: string; to: string }) => ({
                          isActive:
                            checkPath(i, { exact: true }) ||
                            i.pathname.includes('/webhook-registration/') ||
                            i.pathname.includes('/incoming-webhook/')
                        })
                      },
                      ...(webhooksEnabled
                        ? [
                            {
                              label: 'Destinations',
                              to: Paths.instance.eventDestinations(...params),
                              getProps: (i: { pathname: string; to: string }) => ({
                                isActive: checkPath(i, { exact: true })
                              })
                            },
                            {
                              label: 'Events',
                              to: Paths.instance.events(...params),
                              getProps: (i: { pathname: string; to: string }) => ({
                                isActive: checkPath(i, { exact: true })
                              })
                            }
                          ]
                        : [])
                    ]
                  },

                  ...(hasCallbacks
                    ? [
                        {
                          icon: <RiListCheck2 />,
                          label: 'Callback Logs',
                          to: Paths.instance.callbackEvents(...params),
                          getProps: (i: { pathname: string; to: string }) => ({
                            isActive: checkPath(i, { exact: true })
                          }),

                          children: [
                            {
                              label: 'Events',
                              to: Paths.instance.callbackEvents(...params),
                              getProps: (i: { pathname: string; to: string }) => ({
                                isActive: checkPath(i, { exact: true })
                              })
                            }
                          ]
                        }
                      ]
                    : [])
                ]
              }
            ]
          : []),

        ...(skillsEnabled
          ? [
              {
                label: 'Skills',
                collapsible: true,
                items: [
                  {
                    icon: <RiSparkling2Line />,
                    label: 'Skills',
                    to: Paths.instance.skills(...params),
                    getProps: (i: { pathname: string; to: string }) => ({
                      isActive: checkPath(i, { exact: true })
                    })
                  },
                  {
                    icon: <RiStore2Line />,
                    label: 'Marketplaces',
                    to: Paths.instance.skillMarketplaces(...params),
                    getProps: (i: { pathname: string; to: string }) => ({
                      isActive: checkPath(i, { exact: true })
                    })
                  },
                  {
                    icon: <RiFileCopyLine />,
                    label: 'Templates',
                    to: Paths.instance.skillTemplates(...params),
                    getProps: (i: { pathname: string; to: string }) => ({
                      isActive: checkPath(i, { exact: true })
                    })
                  },
                  {
                    icon: <RiFolderLine />,
                    label: 'Groups',
                    to: Paths.instance.skillGroups(...params),
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
