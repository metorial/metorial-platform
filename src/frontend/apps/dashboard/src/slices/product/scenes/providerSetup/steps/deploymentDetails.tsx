import { renderWithLoader } from '@metorial/data-hooks';
import { useCreateProviderDeployment, useProvider } from '@metorial/state';
import { Button, Flex, Input, Spacer, Text, theme } from '@metorial/ui';
import { useState } from 'react';
import styled from 'styled-components';
import { useWizard } from '../index';

let ProviderInfo = styled.div`
  padding: 15px;
  background: ${theme.colors.gray100};
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray200};
`;

export let DeploymentDetailsStep = ({ instanceId }: { instanceId: string }) => {
  let { state, setDeploymentId, setStep } = useWizard();
  let [name, setName] = useState('');
  let [description, setDescription] = useState('');
  let [error, setError] = useState<string | null>(null);

  let createMutation = useCreateProviderDeployment();
  let provider = useProvider(instanceId, state.providerId ?? undefined);

  let handleCreate = async () => {
    if (!state.providerId || !name.trim()) return;

    setError(null);

    let [result, err] = await createMutation.mutate({
      instanceId,
      name: name.trim(),
      description: description.trim() || undefined,
      providerId: state.providerId
    });

    if (err) {
      console.error('Failed to create deployment:', err);
      setError(err.data?.message || 'Failed to create deployment');
    } else if (result) {
      setDeploymentId(result.id);
    }
  };

  let handleBack = () => {
    setStep('selectProvider');
  };

  return renderWithLoader({ provider })(({ provider }) => (
    <Flex direction="column" gap={20}>
      <ProviderInfo>
        <Text size="1" color="gray600">
          Selected Provider
        </Text>
        <Spacer size={5} />
        <Text size="2" weight="strong">
          {provider.data.name ?? state.providerName ?? 'Provider'}
        </Text>
        {provider.data.description && (
          <>
            <Spacer size={5} />
            <Text size="1" color="gray600">
              {provider.data.description}
            </Text>
          </>
        )}
      </ProviderInfo>

      <Input
        label="Deployment Name"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="My Deployment"
        required
      />

      <Input
        label="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Optional description for this deployment"
        as="textarea"
        minRows={3}
      />

      {error && (
        <Text size="2" color="red500">
          {error}
        </Text>
      )}

      <Spacer size={10} />

      <Flex justify="space-between">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button
          onClick={handleCreate}
          loading={createMutation.isPending}
          disabled={!name.trim()}
        >
          Create Deployment
        </Button>
      </Flex>
    </Flex>
  ));
};
