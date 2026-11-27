import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProvider } from '@metorial/state';
import { CenteredSpinner } from '@metorial/ui';
import { useEffect, useState } from 'react';
import {
  ProviderCreationPanelShell,
  ProviderSelectionStep,
  showProviderCreationPanel
} from '../providerCreationPanel';
import { ProviderDeploymentForm, type ProviderDeploymentFormProps } from './form';
import type { DashboardInstanceProviderDeploymentsCreateOutput } from '@metorial/dashboard-sdk';

type ProviderDeploymentPanelProps = Extract<
  ProviderDeploymentFormProps,
  { type: 'create' }
> & {
  onCreate?: (deployment: DashboardInstanceProviderDeploymentsCreateOutput) => void;
  onClose?: () => void;
};

export let ProviderDeploymentPanelFlow = (
  p: ProviderDeploymentPanelProps & {
    close: () => void;
    setPanelWidth: (width: number) => void;
  }
) => {
  let instance = useCurrentInstance();
  let instanceId = p.instanceId ?? instance.data?.id;
  let [step, setStep] = useState(p.providerId ? 1 : 0);
  let [providerId, setProviderId] = useState(p.providerId ?? null);
  let provider = useProvider(instanceId, providerId);

  useEffect(() => {
    p.setPanelWidth(step === 0 ? 1050 : 660);
  }, [step, p.setPanelWidth]);

  let steps = [
    {
      title: 'Select Provider',
      render: () =>
        instanceId ? (
          <ProviderSelectionStep
            instanceId={instanceId}
            onSelect={id => {
              setProviderId(id);
              setStep(1);
            }}
          />
        ) : (
          <CenteredSpinner />
        )
    },
    {
      title: 'Create Deployment',
      render: () =>
        renderWithLoader({ provider })(() => (
          <ProviderDeploymentForm
            key={providerId}
            {...p}
            instanceId={instanceId}
            providerId={providerId ?? undefined}
            providerName={p.providerName ?? provider.data?.name ?? undefined}
            onBack={p.providerId ? undefined : () => setStep(0)}
          />
        ))
    }
  ];

  return (
    <ProviderCreationPanelShell
      title="Create Deployment"
      description="Select a provider and create a deployment."
      steps={steps}
      currentStep={step}
      hideStepper={!!p.providerId}
      setCurrentStep={nextStep => {
        if (nextStep === 0 || (nextStep === 1 && providerId)) setStep(nextStep);
      }}
    />
  );
};

export let showProviderDeploymentPanelFlow = (p: ProviderDeploymentPanelProps) =>
  showProviderCreationPanel(
    ({ close, setWidth }) => (
      <ProviderDeploymentPanelFlow {...p} close={close} setPanelWidth={setWidth} />
    ),
    { width: p.providerId ? 660 : 1050, onClose: p.onClose }
  );
