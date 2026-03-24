import type { DashboardInstanceCallbacksCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { useCreateCallback, useProvider, useProviderDeployment } from '@metorial/state';
import {
  Button,
  Callout,
  CenteredSpinner,
  Dialog,
  Input,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { type ReactNode, useState } from 'react';
import { ProviderContextCard } from '../providerContextCard';
import { ProviderDeploymentsList } from '../providerDeployments/list';
import { ProvidersWithDeploymentsSearch } from '../providers/search';
import { Stepper } from '../stepper';

type CallbackDetailsFormValues = {
  name: string;
  description: string;
};

let DIALOG_EXIT_MS = 220;

let closeAndThen = (close: () => void, next?: () => void) => {
  close();
  if (!next) return;
  setTimeout(() => next(), DIALOG_EXIT_MS);
};

let PickerDialogScaffold = ({
  title,
  description,
  close,
  onBack,
  children
}: {
  title: string;
  description: string;
  close: () => void;
  onBack?: () => void;
  children: ReactNode;
}) => (
  <>
    <Dialog.Title>{title}</Dialog.Title>
    <Dialog.Description>{description}</Dialog.Description>

    <Spacer size={10} />

    {children}

    {onBack && (
      <>
        <Spacer size={10} />

        <Dialog.Actions>
          <Button
            size="2"
            variant="outline"
            onClick={() => {
              closeAndThen(close, onBack);
            }}
          >
            Back
          </Button>
        </Dialog.Actions>
      </>
    )}
  </>
);

let CallbackDeploymentPicker = (p: {
  providerId: string;
  close: () => void;
  onSelect: (deploymentId: string) => void;
  onBack?: () => void;
}) => (
  <PickerDialogScaffold
    title="Select Deployment"
    description="Choose a deployment to create a callback for."
    close={p.close}
    onBack={p.onBack}
  >
    <ProviderDeploymentsList
      providerId={p.providerId}
      searchable
      compact
      columns={3}
      limit={18}
      sectionLabel="Deployments"
      emptyText="No deployments found for this provider."
      onDeploymentClick={deployment => {
        closeAndThen(p.close, () => p.onSelect(deployment.id));
      }}
    />
  </PickerDialogScaffold>
);

let CallbackProviderPicker = (p: {
  instanceId: string;
  close: () => void;
  onSelect: (providerId: string) => void;
}) => (
  <PickerDialogScaffold
    title="Create Callback"
    description="Select a provider that already has a deployment."
    close={p.close}
  >
    <ProvidersWithDeploymentsSearch
      instanceId={p.instanceId}
      columns={3}
      limit={18}
      emptyText="No providers with deployments found. Create a deployment first."
      onSelect={provider => {
        closeAndThen(p.close, () => p.onSelect(provider.id));
      }}
    />
  </PickerDialogScaffold>
);

let showPickerModal = (children: (d: { close: () => void }) => ReactNode) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      {children({ close })}
    </Dialog.Wrapper>
  ));

let CallbackCreateModalContent = (p: {
  instanceId: string;
  providerId: string;
  providerDeploymentId: string;
  close: () => void;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
  onBack?: () => void;
}) => {
  let createCallback = useCreateCallback();
  let deployment = useProviderDeployment(p.instanceId, p.providerDeploymentId);
  let provider = useProvider(p.instanceId, p.providerId);
  let [step, setStep] = useState(0);
  let form = useForm<CallbackDetailsFormValues>({
    initialValues: {
      name: '',
      description: ''
    },
    onSubmit: async values => {
      let [result] = await createCallback.mutate({
        instanceId: p.instanceId,
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        providerDeploymentId: p.providerDeploymentId
      });

      if (!result) return;

      p.onCreate?.(result);
      p.close();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Enter a name'),
        description: yup.string().defined()
      })
  });

  if (deployment.isLoading || provider.isLoading) {
    return <CenteredSpinner />;
  }

  if (!deployment.data || !provider.data) {
    return (
      <>
        <Callout color="gray">
          Could not resolve the selected provider deployment. Please try again.
        </Callout>

        <Spacer size={15} />

        <Dialog.Actions>
          <Button variant="outline" onClick={p.onBack ?? p.close}>
            Back
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  let providerContext = (
    <ProviderContextCard
      providerId={provider.data.id}
      providerName={provider.data.name}
      providerImageUrl={provider.data.publisher.imageUrl}
      deploymentName={deployment.data.name}
      deploymentDescription={deployment.data.description}
    />
  );

  let steps = [
    {
      title: 'Provider',
      subtitle: 'Confirm deployment',
      render: () => (
        <>
          {providerContext}

          <Spacer size={15} />

          <Callout color="gray">
            Create the callback now, then add destinations and triggers from the callback
            details page.
          </Callout>

          <Spacer size={15} />

          <Dialog.Actions>
            <Button variant="outline" onClick={p.onBack ?? p.close}>
              Back
            </Button>
            <Button onClick={() => setStep(1)}>Continue</Button>
          </Dialog.Actions>
        </>
      )
    },
    {
      title: 'Details',
      subtitle: 'Name and create',
      render: () => (
        <form onSubmit={form.handleSubmit}>
          {providerContext}

          <Spacer size={15} />

          <Input label="Name" required {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <Text size="1" color="gray600">
            Destinations and triggers can be configured after the callback is created.
          </Text>

          <Spacer size={20} />

          <Dialog.Actions>
            <Button type="button" variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button type="submit" loading={createCallback.isLoading} success={createCallback.isSuccess}>
              Create Callback
            </Button>
          </Dialog.Actions>

          <createCallback.RenderError />
        </form>
      )
    }
  ];

  return <Stepper steps={steps} currentStep={step} setCurrentStep={setStep} />;
};

let showCallbackCreateModal = (p: {
  instanceId: string;
  providerId: string;
  providerDeploymentId: string;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
  onBack?: () => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={700}>
      <Dialog.Title>Create Callback</Dialog.Title>
      <Dialog.Description>
        Create a callback for the selected deployed provider. Destinations and triggers can be
        attached after creation.
      </Dialog.Description>

      <CallbackCreateModalContent {...p} close={close} />
    </Dialog.Wrapper>
  ));

export let showCallbackFormModal = (p: {
  instanceId: string;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
}) => {
  let showDeploymentStep = (providerId: string) =>
    showPickerModal(({ close }) => (
      <CallbackDeploymentPicker
        providerId={providerId}
        close={close}
        onBack={() => showCallbackFormModal(p)}
        onSelect={deploymentId =>
          showCallbackCreateModal({
            instanceId: p.instanceId,
            providerId,
            providerDeploymentId: deploymentId,
            onBack: () => showDeploymentStep(providerId),
            onCreate: p.onCreate
          })
        }
      />
    ));

  return showPickerModal(({ close }) => (
    <CallbackProviderPicker
      instanceId={p.instanceId}
      close={close}
      onSelect={providerId => {
        showDeploymentStep(providerId);
      }}
    />
  ));
};
