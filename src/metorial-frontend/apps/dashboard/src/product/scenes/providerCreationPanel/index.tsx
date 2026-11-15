import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { PillStepper } from '@metorial/explainer';
import type { TableFilterState } from '@metorial/table';
import { Panel, showModal } from '@metorial/ui';
import { type ReactNode, useMemo, useState } from 'react';
import { ProviderListingFilters, useProviderListingFilters } from '../providers/filters';
import { ProvidersWithDeploymentsSearch } from '../providers/search';

type ProviderCreationPanelStep = {
  title: string;
  render: () => ReactNode;
};

export let ProviderCreationPanelShell = (p: {
  title: string;
  description: string;
  steps: ProviderCreationPanelStep[];
  currentStep: number;
  setCurrentStep: (step: number) => void;
  isStepDisabled?: (step: number) => boolean;
  getStepDisabledReason?: (step: number) => ReactNode;
  paneAnimationDelayMs?: number;
  hideStepper?: boolean;
}) => {
  let currentStepContent = p.steps[p.currentStep] ?? p.steps[p.steps.length - 1];

  return (
    <>
      <Panel.Header>
        <Panel.Title>{p.title}</Panel.Title>
        <Panel.Description>{p.description}</Panel.Description>
      </Panel.Header>

      <Panel.Content>
        {p.hideStepper ? (
          (currentStepContent?.render() ?? null)
        ) : (
          <PillStepper
            steps={p.steps}
            currentStep={p.currentStep}
            setCurrentStep={p.setCurrentStep}
            isStepDisabled={p.isStepDisabled}
            getStepDisabledReason={p.getStepDisabledReason}
            paneAnimationDelayMs={p.paneAnimationDelayMs}
          />
        )}
      </Panel.Content>
    </>
  );
};

export let ProviderSelectionStep = (p: {
  instanceId: string;
  onSelect: (providerId: string) => void;
  selectionMode?: 'default' | 'authCredentialsCreate';
  limit?: number;
  emptyText?: string;
  internalScrollHeight?: string | number;
  providerListingsFilter?: DashboardInstanceProviderListingsListQuery;
  excludeProviderIds?: string[];
  prioritizeProvidersWithDeployments?: boolean;
  selectedProviderId?: string;
  creatingProviderId?: string;
  selectionDisabled?: boolean;
}) => {
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, providerListingsFilter: selectedFilter } = useProviderListingFilters({
    search,
    filterState
  });
  let providerListingsFilter = useMemo(
    (): DashboardInstanceProviderListingsListQuery => ({
      ...p.providerListingsFilter,
      ...selectedFilter
    }),
    [p.providerListingsFilter, selectedFilter]
  );

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <ProviderListingFilters
          searchState={[search, setSearch]}
          filterState={[filterState, setFilterState]}
          filters={filters}
          onProviderSelect={listing => {
            if (listing.provider) p.onSelect(listing.provider.id);
          }}
        />
      </div>

      <ProvidersWithDeploymentsSearch
        instanceId={p.instanceId}
        columns={3}
        limit={p.limit ?? 30}
        variant="providerCard"
        cardSize="compact"
        includeAllProviders
        prioritizeProvidersWithDeployments={p.prioritizeProvidersWithDeployments ?? true}
        internalScroll
        internalScrollHeight={p.internalScrollHeight ?? 'calc(100vh - 260px)'}
        selectionMode={p.selectionMode}
        providerListingsFilter={providerListingsFilter}
        excludeProviderIds={p.excludeProviderIds}
        selectedProviderId={p.selectedProviderId}
        creatingProviderId={p.creatingProviderId}
        selectionDisabled={p.selectionDisabled}
        hideSearch
        emptyText={p.emptyText ?? 'No providers found.'}
        onSelect={provider => {
          p.onSelect(provider.id);
        }}
      />
    </>
  );
};

export let showProviderCreationPanel = (
  children: (d: { close: () => void; setWidth: (width: number) => void }) => ReactNode,
  opts?: { width?: number; onClose?: () => void }
) =>
  showModal(
    ({ dialogProps, close }) => {
      let defaultWidth = opts?.width ?? 1100;
      let [width, setWidth] = useState(defaultWidth);

      return (
        <Panel.Wrapper
          {...dialogProps}
          width={width}
          style={{
            transition: 'width 0.42s cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          {children({ close, setWidth })}
        </Panel.Wrapper>
      );
    },
    { onClose: opts?.onClose }
  );
