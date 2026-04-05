import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Paths } from '@metorial/frontend-config';
import { CenteredSpinner } from '@metorial/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ProviderCreationPanelShell,
  ProviderSelectionStep,
  showProviderCreationPanel
} from '../providerCreationPanel';
import { ProviderConfigForm } from './form';

export let ProviderConfigPanelFlow = (p: { instanceId: string; close: () => void }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
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
        title: 'Create Config',
        render: () =>
          providerId ? (
            <ProviderConfigForm
              type="create"
              instanceId={p.instanceId}
              providerId={providerId}
              close={p.close}
              onBack={() => setStep(0)}
              flattenCreateFlow
              onCreate={config => {
                if (!organization.data || !project.data || !instance.data) return;

                navigate(
                  Paths.instance.providerConfig(
                    organization.data,
                    project.data,
                    instance.data,
                    config.id
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
      title="Create Config"
      description="Select a provider and create a configuration."
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

export let showProviderConfigPanelFlow = (p: { instanceId: string }) =>
  showProviderCreationPanel(({ close }) => <ProviderConfigPanelFlow {...p} close={close} />);
