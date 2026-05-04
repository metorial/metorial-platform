import { useForm } from '@metorial/data-hooks';
import {
  IntegrationCreateBody,
  IntegrationPreview,
  useCreateIntegration,
  useIntegration
} from '@metorial/state';
import { Button, Dialog, Input, Spacer, showModal } from '@metorial/ui';

export type IntegrationFormProps =
  | { type: 'create'; instanceId: string }
  | { type: 'update'; instanceId: string; integrationId: string };

export let IntegrationForm = (
  p: IntegrationFormProps & {
    close?: () => void;
    onCreate?: (integration: IntegrationPreview) => void;
    onUpdate?: (integration: IntegrationPreview) => void;
  }
) => {
  let createIntegration = useCreateIntegration();
  let integration = useIntegration(
    p.type === 'update' ? p.instanceId : null,
    p.type === 'update' ? p.integrationId : null
  );
  let initial = p.type === 'update' ? integration.data : null;

  let form = useForm({
    initialValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? ''
    },
    enableReinitialize: true,
    onSubmit: async values => {
      let body: IntegrationCreateBody = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined
      };

      if (p.type === 'create') {
        let [created] = await createIntegration.mutate({ instanceId: p.instanceId, ...body });
        if (!created) return;
        p.onCreate?.(created);
        p.close?.();
        return;
      }

      if (!updateIntegration) return;

      let [updated] = await updateIntegration.mutate(body);
      if (!updated) return;
      p.onUpdate?.(updated);
      p.close?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });

  let updateIntegration = integration.useUpdateMutator();
  let isSaving = createIntegration.isPending || updateIntegration.isPending;

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" required {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      <Spacer size={18} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.close}>
          Cancel
        </Button>
        <Button type="submit" loading={isSaving}>
          {p.type === 'create' ? 'Create Integration' : 'Save Changes'}
        </Button>
      </Dialog.Actions>

      <createIntegration.RenderError />
      {updateIntegration ? <updateIntegration.RenderError /> : null}
    </form>
  );
};

export let showIntegrationFormModal = (
  p: IntegrationFormProps & {
    onCreate?: (integration: IntegrationPreview) => void;
    onUpdate?: (integration: IntegrationPreview) => void;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>
        {p.type === 'create' ? 'Create Integration' : 'Update Integration'}
      </Dialog.Title>
      <Dialog.Description>
        {p.type === 'create'
          ? 'Create a reusable integration contract and attach providers to it.'
          : 'Update integration details and setup options.'}
      </Dialog.Description>
      <IntegrationForm {...p} close={close} />
    </Dialog.Wrapper>
  ));
