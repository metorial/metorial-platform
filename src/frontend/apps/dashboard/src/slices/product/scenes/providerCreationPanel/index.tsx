import { Panel, showModal } from '@metorial/ui';
import { type ReactNode } from 'react';
import { ProvidersWithDeploymentsSearch } from '../providers/search';
import { PillStepper } from '../../../../components/stepper';

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
}) => {
  return (
    <>
      <Panel.Header>
        <Panel.Title>{p.title}</Panel.Title>
        <Panel.Description>{p.description}</Panel.Description>
      </Panel.Header>

      <Panel.Content>
        <PillStepper
          steps={p.steps}
          currentStep={p.currentStep}
          setCurrentStep={p.setCurrentStep}
          isStepDisabled={p.isStepDisabled}
          getStepDisabledReason={p.getStepDisabledReason}
        />
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
}) => {
  return (
    <ProvidersWithDeploymentsSearch
      instanceId={p.instanceId}
      columns={3}
      limit={p.limit ?? 30}
      variant="providerCard"
      cardSize="compact"
      includeAllProviders
      prioritizeProvidersWithDeployments
      internalScroll
      internalScrollHeight={p.internalScrollHeight ?? 'calc(100vh - 260px)'}
      selectionMode={p.selectionMode}
      emptyText={p.emptyText ?? 'No providers found.'}
      onSelect={provider => {
        p.onSelect(provider.id);
      }}
    />
  );
};

export let showProviderCreationPanel = (
  children: (d: { close: () => void }) => ReactNode,
  opts?: { width?: number }
) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={opts?.width ?? 1000}>
      {children({ close })}
    </Panel.Wrapper>
  ));
