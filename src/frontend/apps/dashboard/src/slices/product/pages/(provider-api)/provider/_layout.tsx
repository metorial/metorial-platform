import type {
  DashboardInstanceProviderListingsListOutput,
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
  useProvider,
  useProviderVersions,
  useProviderListings
} from '@metorial/state';
import { Badge, Button, Flex, LinkTabs } from '@metorial/ui';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { showProviderDeploymentFormModal } from '../../../scenes/providerDeployments/modal';

// ── Provider version context ─────────────────────────────────────────

type ProviderVersion = DashboardInstanceProvidersVersionsListOutput['items'][number];
type ProviderVersionId = ProviderVersion['id'];
type ProviderListing = DashboardInstanceProviderListingsListOutput['items'][number];
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

// ── Layout ───────────────────────────────────────────────────────────

export let ProviderLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();

  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);
  let providerData: ProviderData | null = provider.data;

  let pathname = useLocation().pathname;

  // ── Version state (persists across tab navigation) ───────────────
  let versions = useProviderVersions(instance.data?.id, providerId);
  let allVersions: ProviderVersion[] = versions.data?.items ?? [];
  let currentVersionId = providerData?.currentVersion?.id;

  let [selectedVersionId, setSelectedVersionIdState] = useState<ProviderVersionId | undefined>(
    undefined
  );
  let versionStorageKey =
    instance.data?.id && providerId
      ? `provider:selected-version:${instance.data.id}:${providerId}`
      : undefined;

  // Initialize from persisted selection (per provider) and fallback to current version.
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

    if (currentVersionId) {
      setSelectedVersionIdState(currentVersionId);
    }
  }, [allVersions, currentVersionId, selectedVersionId, versionStorageKey]);

  // Keep persisted selection in sync and reset invalid selections.
  useEffect(() => {
    if (
      selectedVersionId &&
      allVersions.length > 0 &&
      !allVersions.some(v => v.id === selectedVersionId)
    ) {
      setSelectedVersionIdState(currentVersionId);
      return;
    }

    if (!versionStorageKey || typeof window === 'undefined') return;

    if (selectedVersionId) {
      window.sessionStorage.setItem(versionStorageKey, selectedVersionId);
    } else {
      window.sessionStorage.removeItem(versionStorageKey);
    }
  }, [allVersions, currentVersionId, selectedVersionId, versionStorageKey]);

  let effectiveVersionId = selectedVersionId ?? currentVersionId;
  let selectedVersion = allVersions.find(v => v.id === effectiveVersionId);
  let isDefaultVersion = effectiveVersionId === currentVersionId;

  let listings = useProviderListings(providerId ? { providerId, limit: 1 } : null);
  let listing: ProviderListing | undefined = listings.data?.items[0];

  let resetToDefault = () => {
    if (currentVersionId) setSelectedVersionIdState(currentVersionId);
  };

  // Sort: current version first, then by date descending
  let sortedVersions = useMemo(
    () =>
      [...allVersions].sort((a, b) => {
        if (a.id === currentVersionId) return -1;
        if (b.id === currentVersionId) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [allVersions, currentVersionId]
  );

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
          top={
            listing?.attributes?.isVerified ||
            listing?.attributes?.isOfficial ||
            listing?.attributes?.isMetorial ||
            (selectedVersion && !isDefaultVersion) ? (
              <Flex gap={8} style={{ alignItems: 'center', marginTop: 6 }}>
                {listing?.attributes?.isVerified && <Badge color="blue">Verified</Badge>}
                {(listing?.attributes?.isOfficial || listing?.attributes?.isMetorial) && (
                  <Badge color="gray">Official</Badge>
                )}
                {selectedVersion && !isDefaultVersion && (
                  <>
                    <Badge color="purple">{selectedVersion.version}</Badge>
                    <Button size="1" variant="ghost" onClick={resetToDefault}>
                      Back to default version
                    </Button>
                  </>
                )}
              </Flex>
            ) : undefined
          }
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

              <Button
                size="2"
                onClick={() =>
                  instance.data &&
                  showProviderDeploymentFormModal({
                    type: 'create',
                    instanceId: instance.data.id,
                    providerId: providerData?.id,
                    providerName: providerData?.name,
                    ...(!isDefaultVersion && selectedVersion
                      ? {
                          lockedProviderVersionId: selectedVersion.id,
                          lockedProviderVersionLabel: selectedVersion.version
                        }
                      : {}),
                    onCreate: deployment =>
                      navigate(
                        Paths.instance.providerDeployment(
                          organization.data,
                          project.data,
                          instance.data,
                          deployment.id
                        )
                      )
                  })
                }
              >
                Deploy Provider
              </Button>
            </>
          }
        />

        {renderWithLoader({ provider })(({ provider }) => (
          <>
            <LinkTabs
              current={pathname}
              links={[
                {
                  label: 'Overview',
                  to: Paths.instance.provider(...providerPathParams)
                },
                {
                  label: 'Readme',
                  to: Paths.instance.provider(...providerPathParams, 'readme')
                },
                {
                  label: 'Tools',
                  to: Paths.instance.provider(...providerPathParams, 'tools')
                },
                {
                  label: 'Auth Methods',
                  to: Paths.instance.provider(...providerPathParams, 'auth-methods')
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
