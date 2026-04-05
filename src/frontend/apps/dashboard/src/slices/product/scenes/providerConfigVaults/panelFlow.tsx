import { useCurrentInstance, useCurrentOrganization, useCurrentProject } from '@metorial/state';
import { Paths } from '@metorial/frontend-config';
import { CenteredSpinner } from '@metorial/ui';
import { useMemo, useState } from 'react';
import {
  ProviderCreationPanelShell,
  ProviderSelectionStep,
  showProviderCreationPanel
} from '../providerCreationPanel';
import { ProviderConfigVaultForm } from './form';

export let ProviderConfigVaultPanelFlow = (p: { instanceId: string; close: () => void }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let [step, setStep] = useState(0);
  let [providerId, setProviderId] = useState<string | null>(null);

  let steps = useMemo(
    () => [
      {
        title: 'Select Provider',
        render: () => (
          <ProviderSelectionStep
            instanceId={p.instanceId}
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
              hideProviderContext
              onCreate={vault => {
                if (!organization.data || !project.data || !instance.data) return;

                window.location.assign(
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
    [organization.data, project.data, instance.data, p.instanceId, p.close, providerId]
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
  showProviderCreationPanel(({ close }) => (
    <ProviderConfigVaultPanelFlow {...p} close={close} />
  ));
