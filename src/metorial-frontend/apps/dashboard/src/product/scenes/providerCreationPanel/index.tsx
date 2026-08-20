import { Input, Panel, showModal } from '@metorial/ui';
import { type ReactNode, useMemo, useState } from 'react';
import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { ProvidersWithDeploymentsSearch } from '../providers/search';
import { PillStepper } from '@metorial/explainer';
import { useSearchFilter } from '@metorial/use-search-filter';

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
  searchPlaceholder?: string;
  internalScrollHeight?: string | number;
  providerListingsFilter?: DashboardInstanceProviderListingsListQuery;
  excludeProviderIds?: string[];
  prioritizeProvidersWithDeployments?: boolean;
  selectedProviderId?: string;
  creatingProviderId?: string;
  selectionDisabled?: boolean;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let providerListingsFilter = useMemo(
    (): DashboardInstanceProviderListingsListQuery => ({
      ...p.providerListingsFilter,
      ...(searchQuery ? { search: searchQuery } : {})
    }),
    [p.providerListingsFilter, searchQuery]
  );

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Input
          label="Search"
          hideLabel
          size="2"
          placeholder={p.searchPlaceholder ?? 'Search providers...'}
          value={search}
          onInput={setSearch}
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
  opts?: { width?: number }
) =>
  showModal(({ dialogProps, close }) => {
    let defaultWidth = opts?.width ?? 1100;
    let [width, setWidth] = useState(defaultWidth);

    return (
      <Panel.Wrapper {...dialogProps} width={width}>
        {children({ close, setWidth })}
      </Panel.Wrapper>
    );
  });
