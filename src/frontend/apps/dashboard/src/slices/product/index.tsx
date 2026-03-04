import { renderWithLoader } from '@metorial/data-hooks';
import { dynamicPage } from '@metorial/dynamic-component';
import { createSlice } from '@metorial/microfrontend';
import { NotFound } from '@metorial/pages';
import { lastInstanceIdStore, useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { ProjectHomePage } from './pages';

// Provider API pages
let ProvidersListLayout = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/_layout').then(c => c.ProvidersListLayout)
);
let ProvidersPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/providers').then(c => c.ProvidersPage)
);
let ProviderDeploymentsListLayout = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/_layout').then(c => c.ProviderDeploymentsListLayout)
);
let ProviderDeploymentsPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-deployments').then(
    c => c.ProviderDeploymentsPage
  )
);
let ProviderAuthConfigsOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-auth-configs').then(
    c => c.ProviderAuthConfigsOverviewPage
  )
);
let ProviderAuthCredentialsOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-auth-credentials').then(
    c => c.ProviderAuthCredentialsOverviewPage
  )
);
let ProviderConfigsOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-configs').then(
    c => c.ProviderConfigsOverviewPage
  )
);
let ProviderConfigVaultsOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-config-vaults').then(
    c => c.ProviderConfigVaultsOverviewPage
  )
);
let ProviderSessionsListLayout = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/_layout').then(c => c.ProviderSessionsListLayout)
);
let ProviderSessionsPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/provider-sessions').then(c => c.ProviderSessionsPage)
);
let SessionTemplatesListLayout = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/_layout').then(c => c.SessionTemplatesListLayout)
);
let SessionTemplatesPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/session-templates').then(c => c.SessionTemplatesPage)
);
let ProviderDeploymentsRedirectPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/redirects').then(
    c => c.ProviderDeploymentsRedirectPage
  )
);
let SessionTemplatesRedirectPage = dynamicPage(() =>
  import('./pages/(provider-api)/(list)/redirects').then(c => c.SessionTemplatesRedirectPage)
);
let ProviderLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider/_layout').then(c => c.ProviderLayout)
);
let ProviderOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/index').then(c => c.ProviderOverviewPage)
);
let ProviderVersionsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/versions').then(c => c.ProviderVersionsPage)
);
let ProviderToolsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/tools').then(c => c.ProviderToolsPage)
);
let ProviderAuthMethodsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/auth-methods').then(c => c.ProviderAuthMethodsPage)
);
let ProviderReadmePage = dynamicPage(() =>
  import('./pages/(provider-api)/provider/readme').then(c => c.ProviderReadmePage)
);
let ProviderDeploymentLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/_layout').then(
    c => c.ProviderDeploymentLayout
  )
);
let ProviderDeploymentOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/index').then(
    c => c.ProviderDeploymentOverviewPage
  )
);
let ProviderDeploymentConfigsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/configs').then(
    c => c.ProviderDeploymentConfigsPage
  )
);
let ProviderDeploymentConfigVaultsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/config-vaults').then(
    c => c.ProviderDeploymentConfigVaultsPage
  )
);
let ProviderDeploymentAuthMethodsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/auth-methods').then(
    c => c.ProviderDeploymentAuthMethodsPage
  )
);
let ProviderDeploymentAuthConfigsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/auth-configs').then(
    c => c.ProviderDeploymentAuthConfigsPage
  )
);
let ProviderDeploymentSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-deployment/settings').then(
    c => c.ProviderDeploymentSettingsPage
  )
);
let ProviderConfigLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config/_layout').then(c => c.ProviderConfigLayout)
);
let ProviderConfigOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config/index').then(
    c => c.ProviderConfigOverviewPage
  )
);
let ProviderConfigSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config/settings').then(
    c => c.ProviderConfigSettingsPage
  )
);
let ProviderConfigVaultLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config-vault/_layout').then(
    c => c.ProviderConfigVaultLayout
  )
);
let ProviderConfigVaultOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config-vault/index').then(
    c => c.ProviderConfigVaultOverviewPage
  )
);
let ProviderConfigVaultSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-config-vault/settings').then(
    c => c.ProviderConfigVaultSettingsPage
  )
);
let ProviderAuthCredentialLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-credential/_layout').then(
    c => c.ProviderAuthCredentialLayout
  )
);
let ProviderAuthCredentialOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-credential/index').then(
    c => c.ProviderAuthCredentialOverviewPage
  )
);
let ProviderAuthCredentialSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-credential/settings').then(
    c => c.ProviderAuthCredentialSettingsPage
  )
);
let ProviderAuthConfigLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-configs/_layout').then(
    c => c.ProviderAuthConfigLayout
  )
);
let ProviderAuthConfigOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-configs/index').then(
    c => c.ProviderAuthConfigOverviewPage
  )
);
let ProviderAuthConfigSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-auth-configs/settings').then(
    c => c.ProviderAuthConfigSettingsPage
  )
);
let ProviderSessionLayout = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/_layout').then(c => c.ProviderSessionLayout)
);
let ProviderSessionProvidersPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/providers').then(
    c => c.ProviderSessionProvidersPage
  )
);
let ProviderSessionRunsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/runs').then(c => c.ProviderSessionRunsPage)
);
let ProviderSessionLogsPage = dynamicPage(() =>
  import('./pages/(provider-api)/provider-session/logs').then(c => c.ProviderSessionLogsPage)
);
let SessionTemplateLayout = dynamicPage(() =>
  import('./pages/(provider-api)/session-template/_layout').then(c => c.SessionTemplateLayout)
);
let SessionTemplateOverviewPage = dynamicPage(() =>
  import('./pages/(provider-api)/session-template/index').then(
    c => c.SessionTemplateOverviewPage
  )
);
let SessionTemplateProvidersPage = dynamicPage(() =>
  import('./pages/(provider-api)/session-template/providers').then(
    c => c.SessionTemplateProvidersPage
  )
);
let SessionTemplateSettingsPage = dynamicPage(() =>
  import('./pages/(provider-api)/session-template/settings').then(
    c => c.SessionTemplateSettingsPage
  )
);

let SetupProviderPage = dynamicPage(() =>
  import('./pages/setup-provider').then(c => c.SetupProviderPage)
);

let CustomProviderCodePage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/code').then(c => c.CustomProviderCodePage)
);
let CustomProviderOverviewPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider').then(c => c.CustomProviderOverviewPage)
);
let CustomProviderVersionsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/versions').then(
    c => c.CustomProviderVersionsPage
  )
);
let CustomProviderSettingsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/settings/settings').then(
    c => c.CustomProviderSettingsPage
  )
);
let CustomProviderLayout = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/_layout').then(
    c => c.CustomProviderLayout
  )
);
let CustomProviderDeploymentsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/deployments').then(
    c => c.CustomProviderDeploymentsPage
  )
);
let CustomProviderListingPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/settings/listing').then(
    c => c.CustomProviderListingPage
  )
);
let ManagedProvidersListLayout = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/_layout').then(c => c.ManagedProvidersListLayout)
);
let ExternalProvidersListLayout = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/_layout').then(c => c.ExternalProvidersListLayout)
);
let ExternalProvidersPage = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/external-providers').then(
    c => c.ExternalProvidersPage
  )
);
let CustomerProvidersPage = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/custom-providers').then(
    c => c.CustomerProvidersPage
  )
);
let LogsListLayout = dynamicPage(() =>
  import('./pages/(logs)/(list)/_layout').then(c => c.LogsListLayout)
);
let ProviderErrorsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-errors').then(c => c.ProviderErrorsPage)
);
let ProviderRunsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-runs').then(c => c.ProviderRunsPage)
);
let SessionsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/sessions').then(c => c.SessionsPage)
);
let ProviderErrorPage = dynamicPage(() =>
  import('./pages/(logs)/provider-error').then(c => c.ProviderErrorPage)
);
let ProviderErrorLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-error/_layout').then(c => c.ProviderErrorLayout)
);
let ProviderRunPage = dynamicPage(() =>
  import('./pages/(logs)/provider-run').then(c => c.ProviderRunPage)
);
let ProviderRunLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-run/_layout').then(c => c.ProviderRunLayout)
);
let SessionPage = dynamicPage(() => import('./pages/(logs)/session').then(c => c.SessionPage));
let SessionLayout = dynamicPage(() =>
  import('./pages/(logs)/session/_layout').then(c => c.SessionLayout)
);
let SessionDeploymentsPage = dynamicPage(() =>
  import('./pages/(logs)/session/deployments').then(c => c.SessionDeploymentsPage)
);
let ProjectPageLayout = dynamicPage(() =>
  import('./pages/_layout').then(c => c.ProjectPageLayout)
);
let ProjectDeveloperPage = dynamicPage(() =>
  import('./pages/developer').then(c => c.ProjectDeveloperPage)
);
let ProjectDeveloperPageLayout = dynamicPage(() =>
  import('./pages/developer/_layout').then(c => c.ProjectDeveloperPageLayout)
);
let ProjectDeveloperAPIPage = dynamicPage(() =>
  import('./pages/developer/api').then(c => c.ProjectDeveloperAPIPage)
);
let ProjectDeveloperEnvironmentsPage = dynamicPage(() =>
  import('./pages/developer/environments').then(c => c.ProjectDeveloperEnvironmentsPage)
);
let ExplorerPage = dynamicPage(() => import('./pages/explorer').then(c => c.ExplorerPage));
let ProjectSettingsPage = dynamicPage(() =>
  import('./pages/settings').then(c => c.ProjectSettingsPage)
);
let ProjectSettingsPageLayout = dynamicPage(() =>
  import('./pages/settings/_layout').then(c => c.ProjectSettingsPageLayout)
);
let CommunityProvidersPage = dynamicPage(() =>
  import('./pages/community/communityProviders').then(c => c.CommunityProvidersPage)
);
let NotFoundPage = dynamicPage(() => import('@metorial/pages').then(c => c.NotFound));
let FlaggedPage = ({ children, flag }: { children: React.ReactNode; flag: string }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) =>
    flags.data.flags[flag as keyof typeof flags.data.flags] ? children : <NotFound />
  );
};
let ProductWrapper = () => {
  let instance = useCurrentInstance();

  useEffect(() => {
    if (!instance.data) return;
    lastInstanceIdStore.set(instance.data.id);
  }, [instance.data]);

  return <Outlet />;
};

export let productInnerSlice = createSlice([
  {
    path: ':organizationId/:projectId/:instanceId',
    element: <ProductWrapper />,

    children: [
      {
        path: '',
        element: <ProjectHomePage />
      },

      {
        path: 'settings',
        element: <ProjectSettingsPageLayout />,

        children: [
          {
            path: '',
            element: <ProjectSettingsPage />
          }
        ]
      },

      {
        path: 'developer',
        element: <ProjectDeveloperPageLayout />,

        children: [
          {
            path: '',
            element: <ProjectDeveloperPage />
          },
          {
            path: 'api',
            element: <ProjectDeveloperAPIPage />
          },
          {
            path: 'environments',
            element: <ProjectDeveloperEnvironmentsPage />
          }
        ]
      },

      /***************
       * Providers
       *************** */
      {
        children: [
          {
            path: '',
            element: (
              <FlaggedPage flag="metorial-gateway-enabled">
                <ManagedProvidersListLayout />
              </FlaggedPage>
            ),

            children: [
              {
                path: 'custom-providers',
                element: <CustomerProvidersPage />
              },
              {
                path: 'custom-providers',
                element: <CustomerProvidersPage />
              }
            ]
          },

          {
            path: '',
            element: (
              <FlaggedPage flag="metorial-gateway-enabled">
                <ExternalProvidersListLayout />
              </FlaggedPage>
            ),

            children: [
              {
                path: 'external-providers',
                element: <ExternalProvidersPage />
              },
              {
                path: 'external-providers',
                element: <ExternalProvidersPage />
              }
            ]
          },

          {
            path: 'custom-provider/:customProviderId',
            element: (
              <FlaggedPage flag="metorial-gateway-enabled">
                <CustomProviderLayout />
              </FlaggedPage>
            ),

            children: [
              {
                path: '',
                element: <CustomProviderOverviewPage />
              },
              {
                path: 'versions',
                element: <CustomProviderVersionsPage />
              },
              {
                path: 'code',
                element: <CustomProviderCodePage />
              },
              {
                path: 'deployments',
                element: <CustomProviderDeploymentsPage />
              },
              {
                path: 'settings',
                element: <CustomProviderSettingsPage />
              },
              {
                path: 'listing',
                element: <CustomProviderListingPage />
              }
            ]
          }
        ]
      },

      /***************
       * Logs
       *************** */
      {
        children: [
          {
            path: '',
            element: <LogsListLayout />,

            children: [
              {
                path: 'sessions',
                element: <SessionsPage />
              },
              {
                path: 'provider-runs',
                element: <ProviderRunsPage />
              },
              {
                path: 'provider-errors',
                element: <ProviderErrorsPage />
              }
            ]
          },

          {
            path: 'provider-error/:providerErrorId',
            element: <ProviderErrorLayout />,

            children: [
              {
                path: '',
                element: <ProviderErrorPage />
              }
            ]
          },

          {
            path: 'provider-error/:providerErrorId',
            element: <ProviderErrorLayout />,

            children: [
              {
                path: '',
                element: <ProviderErrorPage />
              }
            ]
          },

          {
            path: 'provider-run/:providerRunId',
            element: <ProviderRunLayout />,

            children: [
              {
                path: '',
                element: <ProviderRunPage />
              }
            ]
          },

          {
            path: 'provider-run/:providerRunId',
            element: <ProviderRunLayout />,

            children: [
              {
                path: '',
                element: <ProviderRunPage />
              }
            ]
          },

          {
            path: 'session/:sessionId',
            element: <SessionLayout />,

            children: [
              {
                path: '',
                element: <SessionPage />
              },
              {
                path: 'deployments',
                element: <SessionDeploymentsPage />
              },
              {
                path: 'runs',
                element: <ProviderRunsPage />
              }
            ]
          }
        ]
      },

      /***************
       * Provider API (Magnetar)
       *************** */
      {
        path: 'providers',
        element: <ProvidersListLayout />,
        children: [
          {
            path: '',
            element: <ProvidersPage />
          }
        ]
      },

      {
        path: 'configurations',
        element: <ProviderDeploymentsListLayout />,
        children: [
          {
            path: '',
            element: <ProviderDeploymentsPage />
          },
          {
            path: 'configs',
            element: <ProviderConfigsOverviewPage />
          },
          {
            path: 'config-vaults',
            element: <ProviderConfigVaultsOverviewPage />
          },
          {
            path: 'auth-credentials',
            element: <ProviderAuthCredentialsOverviewPage />
          },
          {
            path: 'auth-configs',
            element: <ProviderAuthConfigsOverviewPage />
          }
        ]
      },

      {
        path: 'provider/:providerId',
        element: <ProviderLayout />,
        children: [
          {
            path: '',
            element: <ProviderOverviewPage />
          },
          {
            path: 'readme',
            element: <ProviderReadmePage />
          },
          {
            path: 'tools',
            element: <ProviderToolsPage />
          },
          {
            path: 'auth-methods',
            element: <ProviderAuthMethodsPage />
          },
          {
            path: 'versions',
            element: <ProviderVersionsPage />
          }
        ]
      },

      {
        path: 'configurations/:providerDeploymentId',
        element: <ProviderDeploymentLayout />,
        children: [
          {
            path: '',
            element: <ProviderDeploymentOverviewPage />
          },
          {
            path: 'configs',
            element: <ProviderDeploymentConfigsPage />
          },
          {
            path: 'config-vaults',
            element: <ProviderDeploymentConfigVaultsPage />
          },
          {
            path: 'auth-methods',
            element: <ProviderDeploymentAuthMethodsPage />
          },
          {
            path: 'auth-configs',
            element: <ProviderDeploymentAuthConfigsPage />
          },
          {
            path: 'settings',
            element: <ProviderDeploymentSettingsPage />
          }
        ]
      },
      {
        path: 'provider-config-vault/:providerConfigVaultId',
        element: <ProviderConfigVaultLayout />,
        children: [
          {
            path: '',
            element: <ProviderConfigVaultOverviewPage />
          },
          {
            path: 'settings',
            element: <ProviderConfigVaultSettingsPage />
          }
        ]
      },
      {
        path: 'configurations/:providerDeploymentId/config/:providerConfigId',
        element: <ProviderConfigLayout />,
        children: [
          {
            path: '',
            element: <ProviderConfigOverviewPage />
          },
          {
            path: 'settings',
            element: <ProviderConfigSettingsPage />
          }
        ]
      },
      {
        path: 'configurations/:providerDeploymentId/auth-credential/:providerAuthCredentialsId',
        element: <ProviderAuthCredentialLayout />,
        children: [
          {
            path: '',
            element: <ProviderAuthCredentialOverviewPage />
          },
          {
            path: 'settings',
            element: <ProviderAuthCredentialSettingsPage />
          }
        ]
      },
      {
        path: 'configurations/:providerDeploymentId/auth-config/:providerAuthConfigId',
        element: <ProviderAuthConfigLayout />,
        children: [
          {
            path: '',
            element: <ProviderAuthConfigOverviewPage />
          },
          {
            path: 'settings',
            element: <ProviderAuthConfigSettingsPage />
          }
        ]
      },

      {
        path: 'provider-sessions',
        element: <ProviderSessionsListLayout />,
        children: [
          {
            path: '',
            element: <ProviderSessionsPage />
          }
        ]
      },
      {
        path: 'provider-runs',
        element: <ProviderSessionsListLayout />,
        children: [
          {
            path: '',
            element: <ProviderRunsPage />
          }
        ]
      },
      {
        path: 'provider-errors',
        element: <ProviderSessionsListLayout />,
        children: [
          {
            path: '',
            element: <ProviderErrorsPage />
          }
        ]
      },

      {
        path: 'provider-session/:sessionId',
        element: <ProviderSessionLayout />,
        children: [
          {
            path: '',
            element: <ProviderSessionLogsPage />
          },
          {
            path: 'providers',
            element: <ProviderSessionProvidersPage />
          },
          {
            path: 'runs',
            element: <ProviderSessionRunsPage />
          }
        ]
      },

      {
        path: 'session-templates',
        element: <SessionTemplatesListLayout />,
        children: [
          {
            path: '',
            element: <SessionTemplatesPage />
          }
        ]
      },

      {
        path: 'session-template/:sessionTemplateId',
        element: <SessionTemplateLayout />,
        children: [
          {
            path: '',
            element: <SessionTemplateOverviewPage />
          },
          {
            path: 'providers',
            element: <SessionTemplateProvidersPage />
          },
          {
            path: 'settings',
            element: <SessionTemplateSettingsPage />
          }
        ]
      },

      /***************
       * Explorer
       *************** */
      {
        path: 'explorer',
        element: <ExplorerPage />
      },

      {
        path: 'community',
        children: [
          {
            path: 'providers',
            element: <CommunityProvidersPage />
          }
        ]
      }
    ]
  }
]);

export let productSlice = createSlice([
  {
    element: <ProjectPageLayout />,
    children: productInnerSlice.routes
  }
]);
