import {
  useCreateProviderAuthConfig,
  useCreateProviderAuthCredentials,
  useProviderAuthCredentials,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import {
  AccordionSingle,
  Button,
  CenteredSpinner,
  Dialog,
  Flex,
  Input,
  Select,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { JSONSchema7 } from 'json-schema';
import { useState } from 'react';
import { JsonSchemaInput } from '../jsonSchemaInput';

type AuthMethod = {
  id: string;
  type: 'oauth' | 'token' | 'custom';
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown> | null;
  scopes: { id: string; scope: string; name: string; description: string | null }[] | null;
};

type AuthCredential = {
  id: string;
  name: string | null;
  clientId: string | null;
};

let ConfigureAuthContent = ({
  instanceId,
  deploymentId,
  onComplete,
  onCancel
}: {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  onComplete: (result: unknown) => void;
  onCancel: () => void;
}) => {
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let authMethods = useProviderAuthMethods(instanceId, deployment.data?.providerId);
  let authCredentials = useProviderAuthCredentials(instanceId, deploymentId);
  let createAuthConfig = useCreateProviderAuthConfig();
  let createCredentials = useCreateProviderAuthCredentials();

  let [step, setStep] = useState<'method' | 'credentials'>('method');
  let [selectedMethodId, setSelectedMethodId] = useState<string>('');

  // Non-OAuth credential form state
  let [name, setName] = useState('');
  let [description, setDescription] = useState('');
  let [credentialsData, setCredentialsData] = useState<Record<string, unknown>>({});
  let [credentialsDataJson, setCredentialsDataJson] = useState('{}');

  // OAuth credential form state
  let [selectedCredentialsId, setSelectedCredentialsId] = useState('');
  let [isCreatingCredentials, setIsCreatingCredentials] = useState(false);
  let [newCredName, setNewCredName] = useState('');
  let [newCredClientId, setNewCredClientId] = useState('');
  let [newCredClientSecret, setNewCredClientSecret] = useState('');

  let [error, setError] = useState<string | null>(null);

  if (authMethods.isLoading || deployment.isLoading) {
    return <CenteredSpinner />;
  }

  let methods = (authMethods.data?.items ?? []) as AuthMethod[];

  if (!methods.length) {
    return (
      <Flex direction="column" gap={15}>
        <Text size="2" color="gray600">
          This provider does not require authentication.
        </Text>
        <Dialog.Actions>
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
          <Button onClick={() => onComplete(null)}>Continue</Button>
        </Dialog.Actions>
      </Flex>
    );
  }

  let selectedMethod = methods.find(m => m.id === selectedMethodId);

  // Pre-select if only one method, but still show step 1
  if (methods.length === 1 && !selectedMethodId) {
    setSelectedMethodId(methods[0].id);
  }

  // ── Step 2: Enter credentials ──────────────────────────────────────
  if (step === 'credentials' && selectedMethod) {
    let isOAuth = selectedMethod.type === 'oauth';
    let hasSchema =
      selectedMethod.inputSchema &&
      typeof selectedMethod.inputSchema === 'object' &&
      Object.keys(selectedMethod.inputSchema).length > 0;

    // ── OAuth: create/select credentials ──
    if (isOAuth) {
      let handleCreateOAuthCredentials = async () => {
        if (!newCredName || !newCredClientId || !newCredClientSecret) return;
        setError(null);

        let [result, err] = await createCredentials.mutate({
          instanceId,
          providerDeploymentId: deploymentId,
          name: newCredName,
          config: {
            type: 'oauth',
            clientId: newCredClientId,
            clientSecret: newCredClientSecret,
            scopes: selectedMethod.scopes?.map(s => s.scope) ?? []
          }
        });

        if (err) {
          setError(err.data?.message || 'Failed to create credentials.');
        } else if (result) {
          setSelectedCredentialsId(result.id);
          setIsCreatingCredentials(false);
          setNewCredName('');
          setNewCredClientId('');
          setNewCredClientSecret('');
          onComplete(result);
        }
      };

      let resetToMethodStep = () => {
        setStep('method');
        setSelectedMethodId('');
        setSelectedCredentialsId('');
        setIsCreatingCredentials(false);
        setNewCredName('');
        setNewCredClientId('');
        setNewCredClientSecret('');
        setError(null);
      };

      return (
        <Flex direction="column" gap={12}>
          {methods.length > 1 && (
            <Button
              variant="outline"
              size="1"
              onClick={resetToMethodStep}
              style={{ alignSelf: 'flex-start' }}
            >
              Back
            </Button>
          )}

          <Select
            label="Credentials"
            value={selectedCredentialsId}
            placeholder="+ Create new credentials"
            onChange={value => {
              if (value === '__create_new__') {
                setIsCreatingCredentials(true);
                setSelectedCredentialsId('');
              } else {
                setSelectedCredentialsId(value);
                setIsCreatingCredentials(false);
              }
            }}
            items={[
              ...(authCredentials.data?.items ?? []).map((cred) => ({
                id: cred.id,
                label: cred.name || cred.id
              })),
              { type: 'separator' as const },
              { id: '__create_new__', label: '+ Create new credentials' }
            ]}
          />

          {selectedCredentialsId &&
            selectedCredentialsId !== '__create_new__' &&
            !isCreatingCredentials && (
              <>
                <Spacer size={15} />
                <Dialog.Actions>
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button onClick={() => onComplete({ id: selectedCredentialsId })}>
                    Done
                  </Button>
                </Dialog.Actions>
              </>
            )}

          {(isCreatingCredentials || !authCredentials.data?.items?.length) && (
            <>
              <div style={{ borderTop: '1px solid var(--color-gray300, #e2e8f0)' }} />

              <Input
                label="Name"
                value={newCredName}
                onChange={e => setNewCredName(e.target.value)}
                placeholder="e.g. My Google OAuth App"
                required
              />

              <Input
                label="Client ID"
                value={newCredClientId}
                onChange={e => setNewCredClientId(e.target.value)}
                placeholder="Enter client ID from provider"
                required
              />

              <Input
                label="Client Secret"
                value={newCredClientSecret}
                onChange={e => setNewCredClientSecret(e.target.value)}
                placeholder="Enter client secret from provider"
                type="password"
                required
              />

              {selectedMethod.scopes && selectedMethod.scopes.length > 0 && (
                <Text size="1" color="gray600">
                  {selectedMethod.scopes.length} scopes will be requested:{' '}
                  {selectedMethod.scopes.map(s => s.scope.split('/').pop()).join(', ')}
                </Text>
              )}

              {error && (
                <Text size="2" color="red500">
                  {error}
                </Text>
              )}

              <Spacer size={15} />

              <Dialog.Actions>
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateOAuthCredentials}
                  loading={createCredentials.isPending}
                  disabled={!newCredName || !newCredClientId || !newCredClientSecret}
                >
                  Save
                </Button>
              </Dialog.Actions>
            </>
          )}
        </Flex>
      );
    }

    // ── Non-OAuth: direct auth config creation ──
    let handleSubmit = async () => {
      setError(null);

      let parsedCredentials: Record<string, unknown> = {};

      if (hasSchema) {
        parsedCredentials = credentialsData;
      } else {
        try {
          parsedCredentials = JSON.parse(credentialsDataJson);
        } catch {
          setError('Invalid JSON in credentials data.');
          return;
        }
      }

      let [result, err] = await createAuthConfig.mutate({
        instanceId,
        providerDeploymentId: deploymentId,
        name,
        description: description || undefined,
        providerAuthMethodId: selectedMethodId,
        credentials: { type: 'new' as const, data: parsedCredentials }
      });

      if (err) {
        setError(err.data?.message || 'Failed to create auth config.');
      } else if (result) {
        onComplete(result);
      }
    };

    let resetToMethodStep = () => {
      setStep('method');
      setSelectedMethodId('');
      setName('');
      setDescription('');
      setCredentialsData({});
      setCredentialsDataJson('{}');
      setError(null);
    };

    return (
      <Flex direction="column" gap={10}>
        <Flex gap={8} style={{ alignItems: 'center' }}>
          <Button variant="outline" size="1" onClick={resetToMethodStep}>
            Back
          </Button>
          <Text size="2" weight="strong">
            {selectedMethod.name}
          </Text>
          <Text size="1" color="gray600">
            {selectedMethod.type}
          </Text>
        </Flex>

        {selectedMethod.description && (
          <Text size="1" color="gray600">
            {selectedMethod.description}
          </Text>
        )}

        <Spacer size={2} />

        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Production API Key"
          required
        />

        <Spacer size={2} />

        <Input
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
        />

        <Spacer size={2} />

        {hasSchema ? (
          <JsonSchemaInput
            schema={selectedMethod.inputSchema as JSONSchema7}
            value={credentialsData}
            onChange={setCredentialsData}
            label="Credentials"
          />
        ) : (
          <Input
            label="Credentials (JSON)"
            value={credentialsDataJson}
            onChange={e => setCredentialsDataJson(e.target.value)}
            as="textarea"
            minRows={4}
            placeholder='{ "key": "value" }'
            style={{ fontFamily: 'monospace' }}
          />
        )}

        {error && (
          <Text size="2" color="red500">
            {error}
          </Text>
        )}

        <Spacer size={15} />

        <Dialog.Actions>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={createAuthConfig.isPending} disabled={!name}>
            Save
          </Button>
        </Dialog.Actions>
      </Flex>
    );
  }

  // ── Step 1: Pick auth method ───────────────────────────────────────
  return (
    <Flex direction="column" gap={15}>
      <Select
        label="Authentication Method"
        value={selectedMethodId}
        placeholder="Select an authentication method..."
        onChange={value => setSelectedMethodId(value)}
        items={methods.map(method => ({
          id: method.id,
          label: `${method.name} (${method.type})`
        }))}
      />

      {selectedMethod?.description && (
        <Text size="1" color="gray600">
          {selectedMethod.description}
        </Text>
      )}

      <Dialog.Actions>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!selectedMethodId} onClick={() => setStep('credentials')}>
          Next
        </Button>
      </Dialog.Actions>
    </Flex>
  );
};

export let showProviderSetupSessionModal = (p: {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  onComplete?: (result: unknown) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let handleComplete = (result: unknown) => {
      p.onComplete?.(result);
      close();
    };

    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>Configure Authentication</Dialog.Title>
        <Dialog.Description>
          Add authentication credentials for this deployment.
        </Dialog.Description>

        <ConfigureAuthContent
          instanceId={p.instanceId}
          providerId={p.providerId}
          deploymentId={p.deploymentId}
          onComplete={handleComplete}
          onCancel={close}
        />
      </Dialog.Wrapper>
    );
  });
