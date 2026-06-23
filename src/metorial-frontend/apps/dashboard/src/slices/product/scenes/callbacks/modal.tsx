import type { DashboardInstanceCallbacksCreateOutput } from '@metorial/dashboard-sdk';
import {
  useCreateCallback,
  useCreateProviderDeployment,
  useProvider,
  useProviderDeployments
} from '@metorial/state';
import { useEffect, useRef, useState } from 'react';
import {
  ProviderCreationPanelShell,
  ProviderSelectionStep,
  showProviderCreationPanel
} from '../providerCreationPanel';

let getCallbackGeneratedName = (providerName: string | null | undefined, providerId: string) => {
  return `${providerName?.trim() || providerId} Callback`;
};

let CallbackCreatePanelFlow = (p: {
  instanceId: string;
  close: () => void;
  setPanelWidth: (width: number) => void;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
}) => {
  let { close, instanceId, onCreate, setPanelWidth } = p;
  let [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  let [creatingProviderId, setCreatingProviderId] = useState<string | null>(null);
  let createAttemptedProviderIdRef = useRef<string | null>(null);
  let createDeployment = useCreateProviderDeployment();
  let createCallback = useCreateCallback();
  let provider = useProvider(instanceId, creatingProviderId);
  let deployments = useProviderDeployments(
    creatingProviderId ? instanceId : null,
    creatingProviderId
      ? {
          providerId: creatingProviderId,
          limit: 100
        }
      : undefined
  );
  let selectedDeployment =
    deployments.data?.items.find(deployment => deployment.isDefault) ??
    deployments.data?.items[0];

  useEffect(() => {
    setPanelWidth(1100);
  }, [setPanelWidth]);

  useEffect(() => {
    if (!creatingProviderId) return;
    if (createAttemptedProviderIdRef.current === creatingProviderId) return;
    if (deployments.isLoading || provider.isLoading) return;
    if (!provider.data) {
      setCreatingProviderId(null);
      return;
    }

    createAttemptedProviderIdRef.current = creatingProviderId;

    let create = async () => {
      let providerDeploymentId = selectedDeployment?.id;

      if (!providerDeploymentId) {
        let [deployment] = await createDeployment.mutate({
          instanceId,
          providerId: creatingProviderId,
          name: `${provider.data!.name ?? creatingProviderId} Deployment`
        });

        providerDeploymentId = deployment?.id;
      }

      if (!providerDeploymentId) {
        setCreatingProviderId(null);
        return;
      }

      let [result] = await createCallback.mutate({
        instanceId,
        name: getCallbackGeneratedName(provider.data!.name, creatingProviderId),
        providerDeploymentId
      });

      if (!result) {
        setCreatingProviderId(null);
        return;
      }

      onCreate?.(result);
      close();
    };

    void create();
  }, [
    createCallback,
    createDeployment,
    creatingProviderId,
    deployments.isLoading,
    close,
    instanceId,
    onCreate,
    provider.data,
    provider.isLoading,
    selectedDeployment?.id
  ]);

  let steps = [
    {
      title: 'Select Provider',
      render: () => (
        <>
          <ProviderSelectionStep
            instanceId={instanceId}
            limit={30}
            emptyText="No callback-capable providers found."
            internalScrollHeight="calc(100vh - 260px)"
            prioritizeProvidersWithDeployments={false}
            selectedProviderId={selectedProviderId ?? undefined}
            creatingProviderId={creatingProviderId ?? undefined}
            selectionDisabled={!!creatingProviderId}
            providerListingsFilter={{
              capabilities: {
                supportsCallbacks: true
              }
            }}
            onSelect={providerId => {
              if (creatingProviderId) return;
              setSelectedProviderId(providerId);
              setCreatingProviderId(providerId);
            }}
          />

          <createDeployment.RenderError />
          <createCallback.RenderError />
        </>
      )
    }
  ];

  return (
    <ProviderCreationPanelShell
      title="Create Callback"
      description="Select a callback-capable provider to create a callback."
      steps={steps}
      currentStep={0}
      setCurrentStep={() => {}}
      hideStepper
    />
  );
};

export let showCallbackFormModal = (p: {
  instanceId: string;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
}) =>
  showProviderCreationPanel(({ close, setWidth }) => (
    <CallbackCreatePanelFlow
      instanceId={p.instanceId}
      close={close}
      setPanelWidth={setWidth}
      onCreate={p.onCreate}
    />
  ));
