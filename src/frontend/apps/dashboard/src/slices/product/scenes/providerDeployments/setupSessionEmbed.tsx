import {
  useCreateProviderAuthCredentials,
  useCreateProviderSetupSession,
  useGetProviderSetupSession,
  useProviderAuthCredentials,
  useProviderAuthMethods
} from '@metorial/state';
import { Button, Flex, Input, Select, Spacer, Text } from '@metorial/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stepper } from '../stepper';

type AuthMethod = {
  id: string;
  type: 'oauth' | 'token' | 'custom';
  name: string;
  description: string | null;
  inputSchema: Record<string, any> | null;
  scopes: { id: string; scope: string; name: string; description: string | null }[] | null;
};

type AuthCredential = {
  id: string;
  name: string | null;
  clientId: string | null;
};

type SetupSession = {
  id: string;
  status: string;
  url: string | null;
  authConfig?: { id: string } | null;
};

export let ProviderSetupSessionEmbed = ({
  instanceId,
  providerId,
  deploymentId,
  onComplete,
  onCancel,
  cancelLabel = 'Cancel'
}: {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  onComplete: (setupSession: SetupSession | null) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) => {
  let authMethods = useProviderAuthMethods(instanceId, providerId);
  let authCredentials = useProviderAuthCredentials(instanceId, deploymentId);

  let createCredentials = useCreateProviderAuthCredentials();
  let createSetupSession = useCreateProviderSetupSession(instanceId, deploymentId);
  let getSetupSession = useGetProviderSetupSession(instanceId, deploymentId);

  let [selectedMethodId, setSelectedMethodId] = useState<string>('');
  let [selectedCredentialsId, setSelectedCredentialsId] = useState<string>('');
  let [isCreatingCredentials, setIsCreatingCredentials] = useState(false);
  let [isStarting, setIsStarting] = useState(false);
  let [error, setError] = useState<string | null>(null);
  let [setupSession, setSetupSession] = useState<SetupSession | null>(null);
  let [step, setStep] = useState(0);

  let completedRef = useRef(false);
  let pollingRef = useRef(false);
  let onCompleteRef = useRef(onComplete);
  let getSetupSessionRef = useRef(getSetupSession);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    getSetupSessionRef.current = getSetupSession;
  }, [getSetupSession]);

  // New credentials form state
  let [newCredName, setNewCredName] = useState('');
  let [newCredClientId, setNewCredClientId] = useState('');
  let [newCredClientSecret, setNewCredClientSecret] = useState('');

  let selectedMethod = useMemo(
    () =>
      (authMethods.data?.items ?? []).find((m: AuthMethod) => m.id === selectedMethodId) as
        | AuthMethod
        | undefined,
    [authMethods.data?.items, selectedMethodId]
  );

  let isOAuth = selectedMethod?.type === 'oauth';

  let hasSingleMethod = (authMethods.data?.items?.length ?? 0) === 1;
  let connectStepIndex = isOAuth ? 2 : 1;

  useEffect(() => {
    if (!selectedMethodId && hasSingleMethod) {
      setSelectedMethodId(authMethods.data!.items![0].id);
    }
  }, [selectedMethodId, hasSingleMethod, authMethods.data?.items]);

  useEffect(() => {
    if (selectedMethodId) {
      setStep(hasSingleMethod ? connectStepIndex : 0);
    }
  }, [selectedMethodId, hasSingleMethod, connectStepIndex]);

  let handleCreateCredentials = async (): Promise<boolean> => {
    if (!newCredName || !newCredClientId || !newCredClientSecret) return false;
    if (!selectedMethod) return false;

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
      console.error('Failed to create credentials:', err);
      setError(err.data?.message || 'Failed to create credentials');
      return false;
    }

    if (!result) return false;

    setSelectedCredentialsId(result.id);
    setIsCreatingCredentials(false);
    setNewCredName('');
    setNewCredClientId('');
    setNewCredClientSecret('');
    return true;
  };

  let handleStartSetup = async () => {
    if (!selectedMethodId) return;

    setError(null);
    setIsStarting(true);

    let [session, err] = await createSetupSession.mutate({
      providerAuthMethodId: selectedMethodId,
      providerAuthCredentialsId: selectedCredentialsId || undefined
    });

    setIsStarting(false);

    if (err) {
      console.error('Failed to create setup session:', err);
      setError(err.data?.message || 'Failed to create setup session');
      return;
    }

    if (session) {
      completedRef.current = false;
      pollingRef.current = false;
      setSetupSession(session as SetupSession);
    }
  };

  useEffect(() => {
    if (!setupSession?.id || pollingRef.current) return;
    pollingRef.current = true;

    let canceled = false;
    let attempts = 0;

    let poll = async () => {
      if (canceled || completedRef.current) return;

      let [res, err] = await getSetupSessionRef.current.mutate({
        setupSessionId: setupSession.id
      });

      if (err) {
        console.warn('Failed to poll setup session:', err);
      } else {
        if (res) setSetupSession(res as SetupSession);

        if (res?.status === 'completed') {
          completedRef.current = true;
          onCompleteRef.current(res as SetupSession);
          return;
        }

        if (res?.status === 'failed' || res?.status === 'expired') {
          setError(
            res?.status === 'expired'
              ? 'Setup session expired. Please start again.'
              : 'Setup session failed. Please try again.'
          );
          return;
        }
      }

      attempts += 1;
      if (attempts > 120) {
        setError('Authentication timed out. Please try again.');
        return;
      }

      setTimeout(poll, 2000);
    };

    poll();

    return () => {
      canceled = true;
    };
  }, [setupSession?.id]);

  if (authMethods.isLoading || authCredentials.isLoading) {
    return (
      <Text size="2" color="gray600">
        Loading authentication methods...
      </Text>
    );
  }

  if (!authMethods.data?.items?.length) {
    return (
      <Flex direction="column" gap={8}>
        <Text size="2" color="gray600">
          This provider does not require authentication.
        </Text>
        <Flex gap={10}>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button onClick={() => onComplete(null)}>Continue</Button>
        </Flex>
      </Flex>
    );
  }

  if (setupSession && !setupSession.url) {
    return (
      <Flex direction="column" gap={8}>
        <Text size="2" color="red600">
          Setup session did not return a URL. Please try again.
        </Text>
        <Flex gap={10}>
          <Button
            variant="outline"
            onClick={() => {
              setSetupSession(null);
              pollingRef.current = false;
            }}
          >
            Change Method
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
        </Flex>
      </Flex>
    );
  }

  let steps = useMemo(() => {
    let methodStep = {
      title: 'Method',
      subtitle: 'Select auth method',
      render: () => (
        <>
          <Select
            label="Authentication Method"
            value={selectedMethodId}
            placeholder="Select an authentication method..."
            onChange={value => {
              setSelectedMethodId(value);
              setSelectedCredentialsId('');
              setIsCreatingCredentials(false);
              setError(null);
            }}
            items={(authMethods.data?.items ?? []).map((method: AuthMethod) => ({
              id: method.id,
              label: `${method.name} (${method.type})`
            }))}
          />
          {selectedMethod?.description && (
            <>
              <Spacer size={5} />
              <Text size="1" color="gray600">
                {selectedMethod.description}
              </Text>
            </>
          )}
          <Spacer size={8} />
          <Flex gap={8}>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {cancelLabel}
              </Button>
            )}
            <Button type="button" onClick={() => setStep(1)} disabled={!selectedMethodId}>
              Continue
            </Button>
          </Flex>
        </>
      )
    };

    let handleCredentialsContinue = async () => {
      if (isCreatingCredentials) {
        let ok = await handleCreateCredentials();
        if (ok) setStep(2);
      } else {
        setStep(2);
      }
    };

    let credentialsStep = {
      title: 'Credentials',
      subtitle: 'OAuth app credentials',
      render: () => (
        <>
          <Text size="2" weight="strong">
            OAuth Credentials (Optional)
          </Text>
          <Text size="2" color="gray600">
            If you have your own OAuth app, select or create credentials. Otherwise, use the
            default.
          </Text>
          <Spacer size={6} />
          <Select
            label="OAuth App Credentials"
            value={isCreatingCredentials ? '__create_new__' : selectedCredentialsId}
            placeholder="Use default credentials"
            onChange={value => {
              if (value === '__create_new__') {
                setIsCreatingCredentials(true);
                setSelectedCredentialsId('');
              } else {
                setIsCreatingCredentials(false);
                setSelectedCredentialsId(value);
              }
            }}
            items={[
              ...(authCredentials.data?.items ?? []).map(
                (cred: { id: string; name?: string | null; clientId?: string | null }) => ({
                  id: cred.id,
                  label: cred.name || cred.clientId || cred.id
                })
              ),
              { type: 'separator' as const },
              { id: '__create_new__', label: '+ Create new credentials' }
            ]}
          />
          {isCreatingCredentials && (
            <>
              <Spacer size={8} />
              <Input
                label="Name"
                value={newCredName}
                onChange={e => setNewCredName(e.target.value)}
                placeholder="My OAuth App"
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
            </>
          )}
          {error && (
            <>
              <Spacer size={5} />
              <Text size="2" color="red600">
                {error}
              </Text>
            </>
          )}
          <Spacer size={12} />
          <Flex gap={8}>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                isCreatingCredentials ? setIsCreatingCredentials(false) : setStep(0)
              }
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handleCredentialsContinue}
              loading={createCredentials.isPending}
              disabled={
                isCreatingCredentials &&
                (!newCredName || !newCredClientId || !newCredClientSecret)
              }
            >
              Continue
            </Button>
          </Flex>
        </>
      )
    };

    let connectStep = {
      title: 'Connect',
      subtitle: 'Complete authentication',
      render: () => {
        if (setupSession?.url) {
          return (
            <>
              <Text size="2" weight="strong">
                Complete authentication
              </Text>
              <Text size="2" color="gray600">
                Finish the setup below. This window will update once authentication completes.
              </Text>
              <Spacer size={5} />
              <iframe
                title="Provider Setup"
                src={setupSession.url}
                style={{
                  width: '100%',
                  height: 560,
                  borderRadius: 8,
                  border: '1px solid var(--color-gray300)'
                }}
              />
              <Spacer size={8} />
              <Flex gap={8}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSetupSession(null);
                    pollingRef.current = false;
                  }}
                >
                  Change Method
                </Button>
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    {cancelLabel}
                  </Button>
                )}
              </Flex>
              {error && (
                <>
                  <Spacer size={5} />
                  <Text size="2" color="red600">
                    {error}
                  </Text>
                </>
              )}
            </>
          );
        }
        return (
          <>
            <Button
              type="button"
              onClick={handleStartSetup}
              loading={isStarting || createSetupSession.isPending}
              disabled={!selectedMethodId}
            >
              {isOAuth ? 'Connect with OAuth' : 'Start Setup'}
            </Button>
            {error && (
              <>
                <Spacer size={5} />
                <Text size="2" color="red600">
                  {error}
                </Text>
              </>
            )}
            <Spacer size={8} />
            <Flex gap={8}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(prev => prev - 1)}
              >
                Back
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  {cancelLabel}
                </Button>
              )}
            </Flex>
          </>
        );
      }
    };

    if (isOAuth) {
      return [methodStep, credentialsStep, connectStep];
    }
    return [
      methodStep,
      {
        ...connectStep,
        subtitle: 'Start setup'
      }
    ];
  }, [
    selectedMethodId,
    selectedMethod,
    selectedCredentialsId,
    isCreatingCredentials,
    newCredName,
    newCredClientId,
    newCredClientSecret,
    setupSession,
    error,
    isOAuth,
    authMethods.data?.items,
    authCredentials.data?.items
  ]);

  return <Stepper steps={steps} currentStep={step} setCurrentStep={setStep} />;
};
