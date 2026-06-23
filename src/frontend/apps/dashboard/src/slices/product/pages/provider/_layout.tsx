import type {
  DashboardInstanceProviderListingsGetOutput,
  DashboardInstanceProvidersGetOutput
} from '@metorial/dashboard-sdk';
import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
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
import { Avatar, Callout, Flex, LinkTabs, Spacer } from '@metorial/ui';
import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import { OpenExplorerButton } from '../../components/openExplorer';
import { UseProviderButton } from '../../scenes/providers/useProviderButton';
import {
  ProviderVersionContext,
  type ProviderVersion,
  type ProviderVersionContextValue,
  type ProviderVersionId
} from './providerVersionContext';

type ProviderListing = DashboardInstanceProviderListingsGetOutput;
type ProviderData = DashboardInstanceProvidersGetOutput;

export let ProviderLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);
  let providerData: ProviderData | null = provider.data;

  let pathname = useLocation().pathname;
  let navigate = useNavigate();

  useEffect(() => {
    if (!provider.data) return;

    if (providerId !== provider.data.slug) {
      navigate(pathname.replace(providerId ?? '', provider.data.slug), { replace: true });
    }
  }, [providerId, provider.data]);

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
    providerData?.slug ?? providerId
  ] as const;

  return (
    <ProviderVersionContext.Provider value={versionContext}>
      <ContentLayout>
        <PageHeader
          // top={<Avatar entity={listing ?? null} size={50} radius={5} />}
          title={
            <Flex align="center" gap={10}>
              <Avatar entity={listing ?? null} size={50} radius={5} />
              {listing?.name ?? providerData?.name ?? '...'}
            </Flex>
          }
          description={listing?.description ?? providerData?.description ?? undefined}
          actions={
            <>
              <OpenExplorerButton
                variant="outline"
                disabled={!providerData?.id}
                to={Paths.instance.explorer(organization.data, project.data, instance.data, {
                  provider_id: providerData?.id
                })}
              />

              <UseProviderButton
                providerId={providerData?.id}
                providerName={listing?.name ?? providerData?.name}
                providerDescription={listing?.description ?? providerData?.description}
              />
            </>
          }
        />

        <InitialLoadBoundary>
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
                            <strong>{listing?.provider.publisher.name}</strong>. Data you send
                            to it will leave Metorial's platform.
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
        </InitialLoadBoundary>
      </ContentLayout>
    </ProviderVersionContext.Provider>
  );
};
