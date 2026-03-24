import type { DashboardInstanceCallbacksCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCallbackDestinations,
  useCreateCallback,
  useProviderDeployments
} from '@metorial/state';
import {
  Button,
  Callout,
  CenteredSpinner,
  Dialog,
  Input,
  MultiSelect,
  Select,
  Spacer,
  TextArrayInput,
  showModal
} from '@metorial/ui';
import { showCallbackDestinationFormModal } from './destinationModal';

type CallbackFormValues = {
  name: string;
  description: string;
  providerDeploymentId: string;
  destinationIds: string[];
  triggerIds: string[];
};

let normalizeStringArray = (values: string[]) =>
  [...new Set(values.map(value => value.trim()).filter(Boolean))];

let CallbackFormModalContent = (p: {
  instanceId: string;
  close: () => void;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
}) => {
  let createCallback = useCreateCallback();
  let deployments = useProviderDeployments(p.instanceId, {
    order: 'desc',
    limit: 100
  });
  let destinations = useCallbackDestinations(p.instanceId, {
    order: 'desc',
    limit: 100
  });
  let form = useForm<CallbackFormValues>({
    initialValues: {
      name: '',
      description: '',
      providerDeploymentId: '',
      destinationIds: [],
      triggerIds: ['']
    },
    onSubmit: async values => {
      let triggerIds = normalizeStringArray(values.triggerIds);
      let [result] = await createCallback.mutate({
        instanceId: p.instanceId,
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        providerDeploymentId: values.providerDeploymentId,
        destinationIds: values.destinationIds,
        triggers: triggerIds.map(triggerId => ({ triggerId }))
      });

      if (!result) return;

      p.onCreate?.(result);
      p.close();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Enter a name'),
        description: yup.string().defined(),
        providerDeploymentId: yup.string().required('Select a provider deployment'),
        destinationIds: yup
          .array()
          .of(yup.string().required())
          .min(1, 'Select at least one destination')
          .defined(),
        triggerIds: yup
          .array()
          .of(yup.string().defined())
          .defined()
          .test(
            'triggerIds',
            'Enter at least one provider trigger key',
            value => normalizeStringArray(value ?? []).length > 0
          )
      })
  });

  let deploymentItems = (deployments.data?.items ?? []).map(deployment => ({
    id: deployment.id,
    label: deployment.name || deployment.id
  }));
  let destinationItems = (destinations.data?.items ?? []).map(destination => ({
    id: destination.id,
    label: destination.name
  }));

  if (
    deployments.isLoading &&
    destinations.isLoading &&
    !deployments.data?.items.length &&
    !destinations.data?.items.length
  ) {
    return <CenteredSpinner />;
  }

  return (
    <form onSubmit={form.handleSubmit}>
      {deploymentItems.length === 0 && (
        <>
          <Callout color="gray">
            Create a provider deployment before creating a callback.
          </Callout>
          <Spacer height={15} />
        </>
      )}

      <Input label="Name" {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer height={15} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      <Spacer height={15} />

      <Select
        label="Provider Deployment"
        placeholder={
          deploymentItems.length === 0 ? 'No deployments available' : 'Select a deployment'
        }
        value={form.values.providerDeploymentId}
        onChange={value => form.setFieldValue('providerDeploymentId', value)}
        items={deploymentItems}
        error={form.errors.providerDeploymentId}
        disabled={deploymentItems.length === 0}
      />

      <Spacer height={15} />

      <MultiSelect
        label="Destinations"
        description="Callback destinations are managed at the instance level."
        placeholder="Select destinations"
        value={form.values.destinationIds}
        onChange={value => form.setFieldValue('destinationIds', value)}
        items={destinationItems}
        error={form.errors.destinationIds as string | undefined}
        disabled={destinationItems.length === 0}
      />
      <form.RenderError field="destinationIds" />

      <Spacer height={10} />

      <Button
        type="button"
        size="1"
        variant="outline"
        onClick={() =>
          showCallbackDestinationFormModal({
            instanceId: p.instanceId,
            onCreate: destination =>
              form.setFieldValue('destinationIds', [
                ...new Set([...form.values.destinationIds, destination.id])
              ])
          })
        }
      >
        Create Destination
      </Button>

      <Spacer height={15} />

      <Callout color="gray">
        Trigger choices are not exposed in the dashboard yet. Enter provider trigger keys
        manually; event type filters can still be added through the API if needed.
      </Callout>

      <Spacer height={15} />

      <TextArrayInput
        label="Trigger Keys"
        description="Use trigger IDs from the selected provider deployment specification."
        value={form.values.triggerIds}
        onChange={value => form.setFieldValue('triggerIds', value)}
        placeholder="messages.created"
        error={form.errors.triggerIds as string | string[] | undefined}
        autoAdd
      />
      <form.RenderError field="triggerIds" />

      <Spacer height={20} />

      <Dialog.Actions>
        <Button variant="outline" type="button" onClick={p.close}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={createCallback.isLoading}
          success={createCallback.isSuccess}
          disabled={deploymentItems.length === 0}
        >
          Create Callback
        </Button>
      </Dialog.Actions>

      <createCallback.RenderError />
    </form>
  );
};

export let showCallbackFormModal = (p: {
  instanceId: string;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>Create Callback</Dialog.Title>
      <Dialog.Description>
        Create a callback for a deployed provider and subscribe it to one or more trigger
        keys.
      </Dialog.Description>

      <CallbackFormModalContent {...p} close={close} />
    </Dialog.Wrapper>
  ));
