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
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { showProviderDeploymentFormModal } from '../../../scenes/providerDeployments/modal';

// ── Provider version context ─────────────────────────────────────────

type VersionItem = {
  id: string;
  version: string;
  status?: string;
  isCurrent?: boolean;
  createdAt: Date;
};

type ProviderVersionContextValue = {
  selectedVersionId: string | undefined;
  setSelectedVersionId: (id: string) => void;
  currentVersionId: string | undefined;
  selectedVersion: VersionItem | undefined;
  allVersions: VersionItem[];
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

  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);

  let pathname = useLocation().pathname;

  // ── Version state (persists across tab navigation) ───────────────
  let versions = useProviderVersions(instance.data?.id, providerId);
  let allVersions = (versions.data?.items ?? []) as VersionItem[];
  let currentVersionId = provider.data?.currentVersion?.id;

  let [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(undefined);
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
        setSelectedVersionId(storedVersionId);
        return;
      }
    }

    if (currentVersionId) {
      setSelectedVersionId(currentVersionId);
    }
  }, [allVersions, currentVersionId, selectedVersionId, versionStorageKey]);

  // Keep persisted selection in sync and reset invalid selections.
  useEffect(() => {
    if (
      selectedVersionId &&
      allVersions.length > 0 &&
      !allVersions.some(v => v.id === selectedVersionId)
    ) {
      setSelectedVersionId(currentVersionId);
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

  // Fetch listing metadata for the selected provider version.
  let listings = useProviderListings(
    providerId ? { limit: 100 } : null
  );
  let listing = (listings?.data?.items ?? []).find(
    item =>
      item.provider?.id === providerId &&
      (!effectiveVersionId || item.provider?.currentVersion?.id === effectiveVersionId)
  );

  let resetToDefault = () => {
    if (currentVersionId) setSelectedVersionId(currentVersionId);
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
      setSelectedVersionId,
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
    provider.data?.id ?? providerId
  ] as const;

  return (
    <ProviderVersionContext.Provider value={versionContext}>
      <ContentLayout>
        <PageHeader
          title={listing?.name ?? provider.data?.name ?? '...'}
          description={listing?.description ?? provider.data?.description ?? undefined}
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
              label: provider.data?.name,
              href: Paths.instance.provider(
                organization.data,
                project.data,
                instance.data,
                provider.data?.id ?? providerId
              )
            }
          ]}
          actions={
            <>
              <Link
                to={Paths.instance.explorer(organization.data, project.data, instance.data, {
                  provider_id: provider.data?.id
                })}
              >
                <Button as="span" size="2" variant="outline">
                  Open Explorer
                </Button>
              </Link>

              <Button
                size="2"
                onClick={() =>
                  showProviderDeploymentFormModal({
                    type: 'create',
                    providerId: provider.data?.id,
                    providerName: provider.data?.name,
                    ...(!isDefaultVersion && selectedVersion
                      ? {
                          lockedProviderVersionId: selectedVersion.id,
                          lockedProviderVersionLabel: selectedVersion.version
                        }
                      : {})
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
