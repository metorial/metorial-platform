import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Paths } from '@metorial/frontend-config';
import { CenteredSpinner } from '@metorial/ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ProviderCreationPanelShell,
  ProviderSelectionStep,
  showProviderCreationPanel
} from '../providerCreationPanel';
import { ProviderConfigVaultForm } from './form';

export let ProviderConfigVaultPanelFlow = (p: {
  instanceId: string;
  close: () => void;
  setPanelWidth: (width: number) => void;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let [step, setStep] = useState(0);
  let [providerId, setProviderId] = useState<string | null>(null);

  useEffect(() => {
    if (step === 0) {
      p.setPanelWidth(1050);
      return;
    }

    p.setPanelWidth(660);
  }, [step, p.setPanelWidth]);

  let steps = useMemo(
    () => [
      {
        title: 'Select Provider',
        render: () => (
          <ProviderSelectionStep
            instanceId={p.instanceId}
            providerListingsFilter={{
              capabilities: {
                supportsConfig: true
              }
            }}
            onSelect={nextProviderId => {
              setProviderId(nextProviderId);
              setStep(1);
            }}
          />
        )
      },
      {
        title: 'Create Vault',
        render: () =>
          providerId ? (
            <ProviderConfigVaultForm
              type="create"
              instanceId={p.instanceId}
              providerId={providerId}
              close={p.close}
              onBack={() => setStep(0)}
              onCreate={vault => {
                if (!organization.data || !project.data || !instance.data) return;

                navigate(
                  Paths.instance.providerConfigVault(
                    organization.data,
                    project.data,
                    instance.data,
                    vault.id
                  )
                );
              }}
            />
          ) : (
            <CenteredSpinner />
          )
      }
    ],
    [
      organization.data,
      project.data,
      instance.data,
      p.instanceId,
      p.close,
      providerId,
      navigate
    ]
  );

  return (
    <ProviderCreationPanelShell
      title="Create Config Vault"
      description="Select a provider and create a reusable config vault."
      steps={steps}
      currentStep={step}
      setCurrentStep={nextStep => {
        if (nextStep === 0) {
          setStep(0);
          return;
        }
        if (nextStep === 1 && providerId) {
          setStep(1);
        }
      }}
    />
  );
};

export let showProviderConfigVaultPanelFlow = (p: { instanceId: string }) =>
  showProviderCreationPanel(({ close, setWidth }) => (
    <ProviderConfigVaultPanelFlow {...p} close={close} setPanelWidth={setWidth} />
  ));
