import { useCurrentInstance, useCurrentOrganization, useCurrentProject } from '@metorial/state';
import { Paths } from '@metorial/frontend-config';
import { CenteredSpinner } from '@metorial/ui';
import { useMemo, useState } from 'react';
import {
  ProviderCreationPanelShell,
  ProviderSelectionStep,
  showProviderCreationPanel
} from '../providerCreationPanel';
import { ProviderAuthCredentialsForm } from './modal';

export let ProviderAuthCredentialsPanelFlow = (p: {
  instanceId: string;
  close: () => void;
}) => {
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
            selectionMode="authCredentialsCreate"
            limit={30}
            emptyText="No providers found."
            onSelect={nextProviderId => {
              setProviderId(nextProviderId);
              setStep(1);
            }}
          />
        )
      },
      {
        title: 'Create Credentials',
        render: () =>
          providerId ? (
            <ProviderAuthCredentialsForm
              instanceId={p.instanceId}
              providerId={providerId}
              close={p.close}
              onBack={() => setStep(0)}
              embedded
              hideProviderContext
              onCreate={credentials => {
                if (!organization.data || !project.data || !instance.data) return;

                window.location.assign(
                  Paths.instance.providerAuthCredential(
                    organization.data,
                    project.data,
                    instance.data,
                    credentials.id
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
      title="Create Auth Credentials"
      description="Select a provider and create OAuth credentials."
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

export let showProviderAuthCredentialsPanelFlow = (p: { instanceId: string }) =>
  showProviderCreationPanel(({ close }) => (
    <ProviderAuthCredentialsPanelFlow {...p} close={close} />
  ));
