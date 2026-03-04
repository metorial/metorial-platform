import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCreateProviderDeployment } from '@metorial/state';
import { Button, Dialog, Input, Spacer, Text } from '@metorial/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProviderSearch } from '../providers/search';
import { Stepper } from '../stepper';

export type ProviderDeploymentFormProps =
  | {
      type: 'create';
      instanceId?: string;
      providerId?: string;
      providerName?: string;
      lockedProviderVersionId?: string;
      lockedProviderVersionLabel?: string;
    }
  | { type: 'update'; deploymentId: string; instanceId?: string };

export let ProviderDeploymentForm = (
  props: ProviderDeploymentFormProps & {
    close?: () => void;
    onCreate?: (deployment: unknown) => void;
  }
) => {
  let instance = useCurrentInstance();
  let instanceId = props.instanceId ?? instance.data?.id;
  let navigate = useNavigate();
  let createMutation = useCreateProviderDeployment();

  let hasProviderPreset = props.type === 'create' && !!props.providerId;

  let [step, setStep] = useState(hasProviderPreset ? 1 : 0);
  let [providerId, setProviderId] = useState(
    props.type === 'create' ? (props.providerId ?? '') : ''
  );
  let [providerName, setProviderName] = useState(
    props.type === 'create' ? (props.providerName ?? '') : ''
  );
  let form = useForm({
    initialValues: {
      name: props.type === 'create' ? (props.providerName ?? '') : '',
      description: ''
    },
    onSubmit: async () => {},
    schemaDependencies: [providerId],
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().defined()
      })
  });

  let handleSubmit = async () => {
    let name = form.values.name.trim();

    if (!name) {
      form.setFieldTouched('name', true);
      form.setFieldError('name', 'Name is required');
      return;
    }

    form.setFieldError('name', undefined);

    if (props.type !== 'create' || !instanceId || !providerId) return;

    let [result] = await createMutation.mutate({
      instanceId,
      name,
      description: form.values.description || undefined,
      providerId,
      ...(props.lockedProviderVersionId
        ? { lockedProviderVersionId: props.lockedProviderVersionId }
        : {})
    });

    if (!result) return;

    if (props.onCreate) {
      props.onCreate(result);
      props.close?.();
      return;
    }

    props.close?.();
    if (!instance.data) return;

    let deploymentPath = Paths.instance.providerDeployment(
      instance.data.organization,
      instance.data.project,
      instance.data,
      result.id
    );
    navigate(deploymentPath);
  };

  // If provider is preset, show just the details form (no stepper)
  if (hasProviderPreset) {
    return (
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <Input label="Name" required {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Spacer size={10} />

        <Input label="Description" {...form.getFieldProps('description')} />

        <Spacer size={10} />

        {props.type === 'create' && props.lockedProviderVersionId && (
          <>
            <Text size="2" color="gray600">
              Pinned to version{' '}
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  color: 'var(--color-foreground)'
                }}
              >
                {props.lockedProviderVersionLabel ?? props.lockedProviderVersionId}
              </span>
            </Text>
            <Spacer size={10} />
          </>
        )}

        <Spacer size={15} />

        <Dialog.Actions>
          <Button type="button" variant="outline" onClick={props.close}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            loading={createMutation.isPending}
            disabled={!providerId}
          >
            Create
          </Button>
        </Dialog.Actions>

        <createMutation.RenderError />
      </form>
    );
  }

  // Full stepper flow: Provider → Configuration
  return (
    <Stepper
      steps={[
        {
          title: 'Provider',
          subtitle: 'Choose a provider',
          render: () => (
            <ProviderSearch
              onSelect={provider => {
                setProviderId(provider.id);
                setProviderName(provider.name ?? provider.slug ?? 'Provider');
                if (!form.values.name) {
                  form.setFieldValue(
                    'name',
                    provider.name ?? provider.slug ?? 'Provider'
                  );
                }
                setStep(1);
              }}
            />
          )
        },
        {
          title: 'Configuration',
          subtitle: 'Set up the deployment',
          render: () => (
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              {providerName && (
                <>
                  <Text size="1" color="gray600">
                    Deploying <strong>{providerName}</strong>
                  </Text>
                  <Spacer size={10} />
                </>
              )}

              <Input label="Name" required {...form.getFieldProps('name')} />
              <form.RenderError field="name" />

              <Spacer size={10} />

              <Input label="Description" {...form.getFieldProps('description')} />

              <Spacer size={15} />

              <Dialog.Actions>
                <Button type="button" variant="outline" onClick={props.close}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  loading={createMutation.isPending}
                  disabled={!providerId}
                >
                  Create
                </Button>
              </Dialog.Actions>

              <createMutation.RenderError />
            </form>
          )
        }
      ]}
      currentStep={step}
      setCurrentStep={setStep}
    />
  );
};
