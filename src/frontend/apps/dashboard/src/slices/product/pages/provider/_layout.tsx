import type {
  DashboardInstanceProviderListingsGetOutput,
  DashboardInstanceProvidersGetOutput,
  DashboardInstanceProvidersVersionsListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomProvider,
  useProvider,
  useProviderListing,
  useProviderVersions
} from '@metorial/state';
import { Button, Callout, LinkTabs, Spacer } from '@metorial/ui';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { UseProviderButton } from '../../scenes/providers/useProviderButton';

type ProviderVersion = DashboardInstanceProvidersVersionsListOutput['items'][number];
type ProviderVersionId = ProviderVersion['id'];
type ProviderListing = DashboardInstanceProviderListingsGetOutput;
type ProviderData = DashboardInstanceProvidersGetOutput;

type ProviderVersionContextValue = {
  selectedVersionId: ProviderVersionId | undefined;
  setSelectedVersionId: (id: ProviderVersionId | undefined) => void;
  currentVersionId: ProviderVersionId | undefined;
  selectedVersion: ProviderVersion | undefined;
  allVersions: ProviderVersion[];
  isDefaultVersion: boolean;
  resetToDefault: () => void;
};

let ProviderVersionContext = createContext<ProviderVersionContextValue | null>(null);

export let useProviderVersionContext = () => {
  let ctx = useContext(ProviderVersionContext);
  if (!ctx) throw new Error('useProviderVersionContext must be used within ProviderLayout');
  return ctx;
};

export let ProviderLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);
  let providerData: ProviderData | null = provider.data;

  let pathname = useLocation().pathname;

  let versions = useProviderVersions(instance.data?.id, providerId);
  let allVersions: ProviderVersion[] = versions.data?.items ?? [];
  let currentVersionId = providerData?.currentVersion?.id;
  let sortedVersions = useMemo(
    () =>
      [...allVersions].sort((a, b) => {
        if (a.id === currentVersionId) return -1;
        if (b.id === currentVersionId) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [allVersions, currentVersionId]
  );
  let fallbackVersionId = currentVersionId ?? sortedVersions[0]?.id;

  let [selectedVersionId, setSelectedVersionIdState] = useState<ProviderVersionId | undefined>(
    undefined
  );
  let versionStorageKey =
    instance.data?.id && providerId
      ? `provider:selected-version:${instance.data.id}:${providerId}`
      : undefined;

  useEffect(() => {
    if (selectedVersionId) return;

    if (versionStorageKey && typeof window !== 'undefined') {
      let storedVersionId = window.sessionStorage.getItem(versionStorageKey);
      if (
        storedVersionId &&
        (allVersions.length === 0 || allVersions.some(v => v.id === storedVersionId))
      ) {
        setSelectedVersionIdState(storedVersionId);
        return;
      }
    }

    if (fallbackVersionId) {
      setSelectedVersionIdState(fallbackVersionId);
    }
  }, [allVersions, fallbackVersionId, selectedVersionId, versionStorageKey]);

  // Keep persisted selection in sync and reset invalid selections.
  useEffect(() => {
    if (
      selectedVersionId &&
      allVersions.length > 0 &&
      !allVersions.some(v => v.id === selectedVersionId)
    ) {
      setSelectedVersionIdState(fallbackVersionId);
      return;
    }

    if (!versionStorageKey || typeof window === 'undefined') return;

    if (selectedVersionId) {
      window.sessionStorage.setItem(versionStorageKey, selectedVersionId);
    } else {
      window.sessionStorage.removeItem(versionStorageKey);
    }
  }, [allVersions, fallbackVersionId, selectedVersionId, versionStorageKey]);

  let effectiveVersionId = selectedVersionId ?? fallbackVersionId;
  let selectedVersion = allVersions.find(v => v.id === effectiveVersionId);
  let isDefaultVersion = effectiveVersionId === currentVersionId;

  let listingData = useProviderListing(instance.data?.id, providerId);
  let listing: ProviderListing | undefined = listingData.data ?? undefined;

  let customProvider = useCustomProvider(
    instance.data?.id,
    provider.data?.access == 'tenant' ? providerId : null
  );

  let resetToDefault = () => {
    if (fallbackVersionId) setSelectedVersionIdState(fallbackVersionId);
  };

  let versionContext = useMemo<ProviderVersionContextValue>(
    () => ({
      selectedVersionId: effectiveVersionId,
      setSelectedVersionId: (id: ProviderVersionId | undefined) => {
        setSelectedVersionIdState(id);
      },
      currentVersionId,
      selectedVersion,
      allVersions: sortedVersions,
      isDefaultVersion,
      resetToDefault
    }),
    [effectiveVersionId, currentVersionId, selectedVersion, sortedVersions, isDefaultVersion]
  );

  let providerPathParams = [
    organization.data,
    project.data,
    instance.data,
    providerData?.id ?? providerId
  ] as const;
  return (
    <ProviderVersionContext.Provider value={versionContext}>
      <ContentLayout>
        <PageHeader
          title={listing?.name ?? providerData?.name ?? '...'}
          description={listing?.description ?? providerData?.description ?? undefined}
          pagination={[
            {
              label: 'Providers',
              href: Paths.instance.providers(organization.data, project.data, instance.data)
            },
            {
              label: providerData?.name,
              href: Paths.instance.provider(
                organization.data,
                project.data,
                instance.data,
                providerData?.id ?? providerId
              )
            }
          ]}
          actions={
            <>
              <Link
                to={Paths.instance.explorer(organization.data, project.data, instance.data, {
                  provider_id: providerData?.id
                })}
              >
                <Button as="span" size="2" variant="outline">
                  Open Explorer
                </Button>
              </Link>

              <UseProviderButton
                providerId={providerData?.id}
                providerName={listing?.name ?? providerData?.name}
                providerDescription={listing?.description ?? providerData?.description}
              />
            </>
          }
        />

        {renderWithLoader({ provider })(({ provider }) => (
          <>
            {provider.data.access == 'tenant' ? (
              <>
                <Callout color="blue">
                  <span>
                    This provider is managed and run by your organization. View{' '}
                    <Link
                      to={
                        customProvider.data
                          ? Paths.instance.customProvider(
                              organization.data,
                              project.data,
                              instance.data,
                              customProvider.data.id
                            )
                          : '#'
                      }
                      style={{
                        color: 'inherit',
                        textDecoration: 'underline'
                      }}
                    >
                      custom provider
                    </Link>{' '}
                    for details.
                  </span>
                </Callout>

                <Spacer height={20} />
              </>
            ) : (
              <>
                {provider.data.type.backend == 'mcp.remote' &&
                  !listing?.attributes.isOfficial && (
                    <>
                      <Callout color="blue">
                        <span>
                          This provider is managed and run by{' '}
                          <strong>{listing?.provider.publisher.name}</strong>. Data you send to
                          it will leave Metorial's platform.
                        </span>
                      </Callout>

                      <Spacer height={20} />
                    </>
                  )}

                {provider.data.type.backend == 'mcp.container' && (
                  <>
                    <Callout color="blue">
                      <span>
                        This provider is not managed by Metorial. Make sure to verify the
                        provider's trustworthiness. Contact{' '}
                        <a
                          href="https://metorial.com/support"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Metorial Support
                        </a>{' '}
                        if you have questions.
                      </span>
                    </Callout>

                    <Spacer height={20} />
                  </>
                )}
              </>
            )}

            <LinkTabs
              current={pathname}
              links={[
                {
                  label: 'Overview',
                  to: Paths.instance.provider(...providerPathParams)
                },
                {
                  label: 'Tools & Capabilities',
                  to: Paths.instance.provider(...providerPathParams, 'capabilities')
                },
                {
                  label: 'Versions',
                  to: Paths.instance.provider(...providerPathParams, 'versions')
                }
              ]}
            />

            <Outlet />
          </>
        ))}
      </ContentLayout>
    </ProviderVersionContext.Provider>
  );
};
