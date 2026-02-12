import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCreateProviderDeployment } from '@metorial/state';
import { Button, Dialog, Input, Spacer, Text } from '@metorial/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServerSearch } from '../servers/search';
import { Stepper } from '../stepper';

export type ProviderDeploymentFormProps =
  | { type: 'create'; providerId?: string; lockedProviderVersionId?: string; lockedProviderVersionLabel?: string }
  | { type: 'update'; deploymentId: string };

export let ProviderDeploymentForm = (
  props: ProviderDeploymentFormProps & {
    close?: () => void;
    onCreate?: (deployment: unknown) => void;
  }
) => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let createMutation = useCreateProviderDeployment();

  let hasProviderPreset = props.type === 'create' && !!props.providerId;

  let [step, setStep] = useState(hasProviderPreset ? 1 : 0);
  let [providerId, setProviderId] = useState(
    props.type === 'create' ? props.providerId ?? '' : ''
  );
  let [providerName, setProviderName] = useState('');
  let [name, setName] = useState('');
  let [description, setDescription] = useState('');

  let handleCreate = async () => {
    if (!instance.data) return;

    if (props.type === 'create') {
      let [result] = await createMutation.mutate({
        instanceId: instance.data.instanceId,
        name,
        description: description || undefined,
        provider_id: providerId,
        ...(props.type === 'create' && props.lockedProviderVersionId
          ? { locked_provider_version_id: props.lockedProviderVersionId }
          : {})
      });

      if (!result) return;

      if (props.onCreate) {
        props.onCreate(result);
      } else {
        let deploymentPath = Paths.instance.providerDeployment(
          instance.data.organization,
          instance.data.project,
          instance.data,
          result.id
        );
        navigate(`${deploymentPath}?auth=setup`);
      }

      props.close?.();
    }
  };

  // If provider is preset, show just the details form (no stepper)
  if (hasProviderPreset) {
    return (
      <>
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} required />

        <Spacer size={10} />

        <Input
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <Spacer size={10} />

        {props.type === 'create' && props.lockedProviderVersionId && (
          <>
            <Text size="2" color="gray600">
              Pinned to version{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-foreground)' }}>
                {props.lockedProviderVersionLabel ?? props.lockedProviderVersionId}
              </span>
            </Text>
            <Spacer size={10} />
          </>
        )}

        <Spacer size={15} />

        <Dialog.Actions>
          <Button variant="outline" onClick={props.close}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            loading={createMutation.isPending}
            disabled={!name || !providerId}
          >
            Create
          </Button>
        </Dialog.Actions>
      </>
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
            <ServerSearch
              onSelect={server => {
                setProviderId(server.providerId ?? (server as { server?: { id?: string } }).server?.id ?? server.id);
                setProviderName(server.name);
                if (!name) setName(server.name);
                setStep(1);
              }}
            />
          )
        },
        {
          title: 'Configuration',
          subtitle: 'Set up the deployment',
          render: () => (
            <>
              {providerName && (
                <>
                  <Text size="1" color="gray600">
                    Deploying <strong>{providerName}</strong>
                  </Text>
                  <Spacer size={10} />
                </>
              )}

              <Input label="Name" value={name} onChange={e => setName(e.target.value)} required />

              <Spacer size={10} />

              <Input
                label="Description"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />

              <Spacer size={15} />

              <Dialog.Actions>
                <Button variant="outline" onClick={props.close}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  loading={createMutation.isPending}
                  disabled={!name || !providerId}
                >
                  Create
                </Button>
              </Dialog.Actions>
            </>
          )
        }
      ]}
      currentStep={step}
      setCurrentStep={setStep}
    />
  );
};
