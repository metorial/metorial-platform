import type { DashboardInstanceCallbacksCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateCallback,
  useCreateProviderDeployment,
  useProvider,
  useProviderDeployments
} from '@metorial/state';
import {
  Button,
  Callout,
  CenteredSpinner,
  Dialog,
  Flex,
  Input,
  Spacer,
  Text
} from '@metorial/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TableFilterState } from '../../../../components/table/filter';
import {
  ProviderCreationPanelShell,
  showProviderCreationPanel
} from '../providerCreationPanel';
import { ProviderListingFilters, useProviderListingFilters } from '../providers/filters';
import { ProvidersWithDeploymentsSearch } from '../providers/search';
import { CallbackDeploymentPicker } from './deploymentPicker';

let SEARCH_THRESHOLD = 5;

let PickProviderStep = (p: { instanceId: string; onSelect: (providerId: string) => void }) => {
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, providerListingsFilter } = useProviderListingFilters({
    search,
    filterState
  });

  return (
    <Flex direction="column" gap={15}>
      <ProviderListingFilters
        searchState={[search, setSearch]}
        filterState={[filterState, setFilterState]}
        filters={filters}
      />

      <ProvidersWithDeploymentsSearch
        instanceId={p.instanceId}
        columns={3}
        limit={30}
        variant="providerCard"
        cardSize="compact"
        includeAllProviders
        prioritizeProvidersWithDeployments
        providerListingsFilter={{
          ...providerListingsFilter,
          capabilities: {
            ...(providerListingsFilter.capabilities ?? {}),
            supportsCallbacks: true
          }
        }}
        hideSearch
        internalScroll
        internalScrollHeight="calc(100vh - 360px)"
        emptyText="No providers with callback support found."
        onSelect={provider => p.onSelect(provider.id)}
      />
    </Flex>
  );
};

let SelectDeploymentStep = (p: {
  instanceId: string;
  providerId: string;
  selectedDeploymentId: string | undefined;
  setSelectedDeploymentId: (deploymentId: string | undefined) => void;
  autoAdvanceArmed: boolean;
  disarmAutoAdvance: () => void;
  onBack: () => void;
  onContinue: () => void;
}) => {
  let provider = useProvider(p.instanceId, p.providerId);
  let deployments = useProviderDeployments(p.instanceId, {
    providerId: p.providerId,
    limit: 50
  });
  let createDeployment = useCreateProviderDeployment();

  let deploymentItems = useMemo(
    () => deployments.data?.items ?? [],
    [deployments.data?.items]
  );

  let hasProcessedAutoAdvance = useRef<string | null>(null);
  let [creationError, setCreationError] = useState<string | null>(null);
  let [isCreatingDefault, setIsCreatingDefault] = useState(false);

  useEffect(() => {
    if (!p.autoAdvanceArmed) return;
    if (deployments.isLoading || provider.isLoading) return;
    if (hasProcessedAutoAdvance.current === p.providerId) return;

    hasProcessedAutoAdvance.current = p.providerId;

    if (deploymentItems.length >= 2) {
      p.disarmAutoAdvance();
      if (!p.selectedDeploymentId) {
        p.setSelectedDeploymentId(deploymentItems[0]!.id);
      }
      return;
    }

    if (deploymentItems.length === 1) {
      p.disarmAutoAdvance();
      p.setSelectedDeploymentId(deploymentItems[0]!.id);
      p.onContinue();
      return;
    }

    let providerName = provider.data?.name ?? undefined;
    setIsCreatingDefault(true);
    setCreationError(null);

    (async () => {
      let [result, err] = await createDeployment.mutate({
        instanceId: p.instanceId,
        providerId: p.providerId,
        ...(providerName ? { name: providerName } : {})
      });

      setIsCreatingDefault(false);

      if (!result || err) {
        setCreationError(
          err?.data?.message ?? 'Could not create a default deployment for this provider.'
        );
        return;
      }

      p.disarmAutoAdvance();
      p.setSelectedDeploymentId(result.id);
      p.onContinue();
    })();
  }, [
    p.autoAdvanceArmed,
    p.providerId,
    deployments.isLoading,
    provider.isLoading,
    deploymentItems
  ]);

  if (provider.isLoading || deployments.isLoading || isCreatingDefault) {
    return <CenteredSpinner />;
  }

  if (creationError) {
    return (
      <>
        <Callout color="red">{creationError}</Callout>

        <Spacer size={15} />

        <Dialog.Actions>
          <Button type="button" variant="outline" onClick={p.onBack}>
            Back
          </Button>
          <Button
            type="button"
            onClick={() => {
              hasProcessedAutoAdvance.current = null;
              setCreationError(null);
            }}
          >
            Retry
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  if (deploymentItems.length === 0) {
    return (
      <>
        <Callout color="gray">
          This provider has no deployments yet. Preparing a default deployment...
        </Callout>

        <Spacer size={15} />

        <Dialog.Actions>
          <Button type="button" variant="outline" onClick={p.onBack}>
            Back
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  let pickerItems = deploymentItems.map(deployment => ({
    id: deployment.id,
    name: deployment.name,
    createdAt: deployment.createdAt
  }));

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (!p.selectedDeploymentId) return;
        p.onContinue();
      }}
    >
      <Text size="2" weight="strong">
        Deployment
      </Text>
      <Text size="1" color="gray600">
        Choose the deployment this callback should listen to.
      </Text>

      <Spacer size={10} />

      <CallbackDeploymentPicker
        items={pickerItems}
        value={p.selectedDeploymentId}
        onChange={p.setSelectedDeploymentId}
        searchable={pickerItems.length > SEARCH_THRESHOLD}
        ariaLabel="Select a deployment"
        focusOnMount
      />

      <Spacer size={20} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.onBack}>
          Back
        </Button>
        <Button type="submit" disabled={!p.selectedDeploymentId}>
          Continue
        </Button>
      </Dialog.Actions>
    </form>
  );
};

let CallbackDetailsStep = (p: {
  instanceId: string;
  providerId: string;
  providerDeploymentId: string;
  close: () => void;
  onBack: () => void;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
}) => {
  let createCallback = useCreateCallback();
  let provider = useProvider(p.instanceId, p.providerId);
  let providerName = provider.data?.name?.trim() ?? '';
  let defaultName = providerName ? `${providerName} callback` : 'New callback';

  let form = useForm({
    initialValues: {
      name: defaultName,
      description: ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      let [result] = await createCallback.mutate({
        instanceId: p.instanceId,
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        providerDeploymentId: p.providerDeploymentId
      });

      if (!result) return;

      p.onCreate?.(result);
      p.close();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Enter a name'),
        description: yup.string().optional()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Text size="2" weight="strong">
        Callback Details
      </Text>
      <Text size="1" color="gray600">
        Give this callback a recognizable name. Destinations and triggers can be configured
        after creation.
      </Text>

      <Spacer size={15} />

      <Input label="Name" required autoFocus {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      <createCallback.RenderError />

      <Spacer size={20} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.onBack}>
          Back
        </Button>
        <Button
          type="submit"
          loading={createCallback.isLoading}
          success={createCallback.isSuccess}
          disabled={!form.values.name.trim()}
        >
          Create
        </Button>
      </Dialog.Actions>
    </form>
  );
};

let CallbackCreationFlow = (p: {
  instanceId: string;
  close: () => void;
  setPanelWidth: (width: number) => void;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
}) => {
  let [step, setStep] = useState(0);
  let [providerId, setProviderId] = useState<string | null>(null);
  let [selectedDeploymentId, setSelectedDeploymentId] = useState<string | undefined>(
    undefined
  );
  let [autoAdvanceArmed, setAutoAdvanceArmed] = useState(false);

  useEffect(() => {
    if (step === 0) {
      p.setPanelWidth(1050);
      return;
    }

    p.setPanelWidth(660);
  }, [step, p.setPanelWidth]);

  let canAdvanceToDeployment = !!providerId;
  let canAdvanceToDetails = !!providerId && !!selectedDeploymentId;

  let steps = useMemo(
    () => [
      {
        title: 'Select Provider',
        render: () => (
          <PickProviderStep
            instanceId={p.instanceId}
            onSelect={nextProviderId => {
              if (nextProviderId !== providerId) {
                setSelectedDeploymentId(undefined);
              }
              setProviderId(nextProviderId);
              setAutoAdvanceArmed(true);
              setStep(1);
            }}
          />
        )
      },
      {
        title: 'Choose Deployment',
        render: () =>
          providerId ? (
            <SelectDeploymentStep
              instanceId={p.instanceId}
              providerId={providerId}
              selectedDeploymentId={selectedDeploymentId}
              setSelectedDeploymentId={setSelectedDeploymentId}
              autoAdvanceArmed={autoAdvanceArmed}
              disarmAutoAdvance={() => setAutoAdvanceArmed(false)}
              onBack={() => {
                setAutoAdvanceArmed(false);
                setStep(0);
              }}
              onContinue={() => {
                setStep(2);
              }}
            />
          ) : (
            <CenteredSpinner />
          )
      },
      {
        title: 'Configure Details',
        render: () =>
          providerId && selectedDeploymentId ? (
            <CallbackDetailsStep
              instanceId={p.instanceId}
              providerId={providerId}
              providerDeploymentId={selectedDeploymentId}
              close={p.close}
              onBack={() => {
                setAutoAdvanceArmed(false);
                setStep(1);
              }}
              onCreate={p.onCreate}
            />
          ) : (
            <CenteredSpinner />
          )
      }
    ],
    [p.instanceId, p.close, p.onCreate, providerId, selectedDeploymentId, autoAdvanceArmed]
  );

  return (
    <ProviderCreationPanelShell
      title="Create Callback"
      description="Select a provider, choose a deployment, and configure your callback."
      steps={steps}
      currentStep={step}
      setCurrentStep={nextStep => {
        if (nextStep === 0) {
          setAutoAdvanceArmed(false);
          setStep(0);
          return;
        }

        if (nextStep === 1 && canAdvanceToDeployment) {
          setAutoAdvanceArmed(false);
          setStep(1);
          return;
        }

        if (nextStep === 2 && canAdvanceToDetails) {
          setAutoAdvanceArmed(false);
          setStep(2);
        }
      }}
      isStepDisabled={nextStep => {
        if (nextStep === 1) return !canAdvanceToDeployment;
        if (nextStep === 2) return !canAdvanceToDetails;
        return false;
      }}
      getStepDisabledReason={nextStep => {
        if (nextStep === 1 && !canAdvanceToDeployment) return 'Select a provider first.';
        if (nextStep === 2 && !canAdvanceToDetails) return 'Select a deployment first.';
        return undefined;
      }}
    />
  );
};

export let showCallbackFormModal = (p: {
  instanceId: string;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
}) =>
  showProviderCreationPanel(({ close, setWidth }) => (
    <CallbackCreationFlow
      instanceId={p.instanceId}
      close={close}
      setPanelWidth={setWidth}
      onCreate={p.onCreate}
    />
  ));
