import type {
  DashboardInstanceWebhooksDestinationsCreateOutput,
  DashboardInstanceWebhooksDestinationsListOutput
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateWebhookDestination,
  useRotateWebhookDestinationSigningSecret,
  useWebhookDestination
} from '@metorial/state';
import { Button, Callout, Copy, Dialog, Input, Select, Spacer, showModal } from '@metorial/ui';
import { useState } from 'react';

export type WebhookDestination =
  DashboardInstanceWebhooksDestinationsListOutput['items'][number];

let normalizeOptionalString = (value: string | undefined) => value?.trim() || undefined;

export let showWebhookDestinationFormModal = (p: {
  instanceId: string;
  destination?: WebhookDestination;
  onComplete?: (
    destination: DashboardInstanceWebhooksDestinationsCreateOutput
  ) => void | Promise<void>;
}) =>
  showModal(({ dialogProps, close }) => {
    let createDestination = useCreateWebhookDestination();
    let destination = useWebhookDestination(p.instanceId, p.destination?.id);
    let updateDestination = destination.useUpdateMutator();
    let form = useForm({
      initialValues: {
        name: p.destination?.name ?? '',
        description: p.destination?.description ?? '',
        url: p.destination?.url ?? '',
        method: p.destination?.method ?? ('POST' as 'POST' | 'PUT' | 'PATCH')
      },
      onSubmit: async values => {
        let input = {
          name: values.name.trim(),
          description: normalizeOptionalString(values.description),
          url: values.url.trim(),
          method: values.method
        };
        let [result] = p.destination
          ? await updateDestination.mutate(input)
          : await createDestination.mutate({ instanceId: p.instanceId, ...input });

        if (!result) return;
        await p.onComplete?.(result);
        close();
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Enter a name'),
          description: yup.string(),
          url: yup.string().trim().url('Enter a valid URL').required('Enter a URL'),
          method: yup.mixed<'POST' | 'PUT' | 'PATCH'>().oneOf(['POST', 'PUT', 'PATCH'])
        })
    });
    let mutation = p.destination ? updateDestination : createDestination;

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>{p.destination ? 'Edit destination' : 'New destination'}</Dialog.Title>
        <Dialog.Description>
          Configure the HTTP endpoint that receives webhook events.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <Input label="URL" {...form.getFieldProps('url')} />
          <form.RenderError field="url" />

          <Spacer height={15} />

          <Select
            label="HTTP method"
            value={form.values.method}
            onChange={method =>
              form.setFieldValue('method', method as 'POST' | 'PUT' | 'PATCH')
            }
            items={[
              { id: 'POST', label: 'POST' },
              { id: 'PUT', label: 'PUT' },
              { id: 'PATCH', label: 'PATCH' }
            ]}
          />
          <form.RenderError field="method" />

          <mutation.RenderError />

          <Spacer height={20} />

          <Dialog.Actions>
            <Button variant="outline" type="button" onClick={close} size="2">
              Cancel
            </Button>
            <Button size="2" type="submit" loading={mutation.isLoading}>
              {p.destination ? 'Save destination' : 'Create destination'}
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

export let WebhookDestinationSigningSecretModalContent = (p: {
  instanceId: string;
  webhookDestinationId: string;
  close: () => void;
  onComplete: () => void;
}) => {
  let rotateSecret = useRotateWebhookDestinationSigningSecret();
  let [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  let submit = async () => {
    let [mutation, mutationError] = await rotateSecret.mutate({
      instanceId: p.instanceId,
      webhookDestinationId: p.webhookDestinationId
    });
    if (!mutation || mutationError) return;

    setRevealedSecret(mutation.signingSecret);
    p.onComplete();
  };

  return (
    <>
      <Callout color={revealedSecret ? 'orange' : 'gray'}>
        {revealedSecret
          ? 'Copy this signing secret now. It cannot be read again after this dialog closes.'
          : 'Rotation takes effect immediately. Update your verifier with the newly revealed value before relying on further deliveries.'}
      </Callout>

      <Spacer height={15} />

      {revealedSecret ? (
        <>
          <Copy label="Signing secret" value={revealedSecret} />
          <Spacer height={10} />
          <Callout color="gray">The previous signing secret was invalidated.</Callout>
        </>
      ) : (
        <Callout color="orange">
          Existing signature verification will fail as soon as you rotate this secret.
        </Callout>
      )}

      <rotateSecret.RenderError />

      <Spacer height={20} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.close}>
          {revealedSecret ? 'Done' : 'Cancel'}
        </Button>
        {!revealedSecret ? (
          <Button type="button" loading={rotateSecret.isLoading} onClick={submit}>
            Rotate and reveal once
          </Button>
        ) : null}
      </Dialog.Actions>
    </>
  );
};

export let showWebhookDestinationSigningSecretModal = (p: {
  instanceId: string;
  webhookDestinationId: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={720}>
      <Dialog.Title>Rotate destination signing secret</Dialog.Title>
      <Dialog.Description>
        Verify Metorial-Signature against the exact raw webhook body.
      </Dialog.Description>
      <WebhookDestinationSigningSecretModalContent {...p} close={close} />
    </Dialog.Wrapper>
  ));
