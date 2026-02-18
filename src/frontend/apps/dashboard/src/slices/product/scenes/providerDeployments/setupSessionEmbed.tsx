import {
  useCreateProviderAuthCredentials,
  useCreateProviderSetupSession,
  useGetProviderSetupSession,
  useProviderAuthCredentials,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import { Button, CenteredSpinner, Flex, Input, Select, Spacer, Text } from '@metorial/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  let deployment = useProviderDeployment(instanceId, deploymentId);
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
    if (selectedMethodId && hasSingleMethod) {
      setStep(isOAuth ? 1 : connectStepIndex);
    }
  }, [selectedMethodId, hasSingleMethod, isOAuth, connectStepIndex]);

  let resetCredentialsState = () => {
    setSelectedCredentialsId('');
    setIsCreatingCredentials(false);
    setNewCredName('');
    setNewCredClientId('');
    setNewCredClientSecret('');
  };

  let resetConnectState = () => {
    closePopup();
    setSetupSession(null);
    pollingRef.current = false;
    completedRef.current = false;
    setIsStarting(false);
    setError(null);
  };

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

  let popupRef = useRef<Window | null>(null);

  let closePopup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
  }, []);

  useEffect(() => {
    return () => closePopup();
  }, [closePopup]);

  let handleStartSetup = async () => {
    if (!selectedMethodId) return;

    setError(null);
    setIsStarting(true);

    let providerName = deployment.data?.provider?.name ?? deployment.data?.name ?? 'Provider';
    let methodName = selectedMethod?.name ?? 'Connection';

    let [session, err] = await createSetupSession.mutate({
      providerAuthMethodId: selectedMethodId,
      providerAuthCredentialsId: selectedCredentialsId || undefined,
      name: `${providerName} — ${methodName}`
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

      let s = session as SetupSession;
      if (s.url) {
        let width = 600;
        let height = 700;
        let left = window.screenX + (window.outerWidth - width) / 2;
        let top = window.screenY + (window.outerHeight - height) / 2;
        closePopup();
        popupRef.current = window.open(
          s.url,
          'provider-auth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );
      }
    }
  };

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
              resetCredentialsState();
              resetConnectState();
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
              <Spacer size={6} />
              <Input
                label="Client ID"
                value={newCredClientId}
                onChange={e => setNewCredClientId(e.target.value)}
                placeholder="Enter client ID from provider"
                required
              />
              <Spacer size={6} />
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
              onClick={() => {
                if (isCreatingCredentials) {
                  setIsCreatingCredentials(false);
                } else {
                  resetConnectState();
                  setStep(0);
                }
              }}
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
            <Flex direction="column" gap={8}>
              <Flex direction="column" gap={4} style={{ alignItems: 'center', padding: '24px 0' }}>
                <CenteredSpinner />
                <Spacer size={4} />
                <Text size="2" weight="strong">
                  Waiting for authentication
                </Text>
                <Text size="2" color="gray600" style={{ textAlign: 'center' }}>
                  Complete the sign-in in the popup window. This will update automatically once
                  you're done.
                </Text>
              </Flex>
              {error && (
                <Text size="2" color="red600">
                  {error}
                </Text>
              )}
              <Flex gap={8}>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetConnectState();
                    resetCredentialsState();
                    setStep(0);
                  }}
                >
                  Change Method
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (setupSession?.url) {
                      let width = 600;
                      let height = 700;
                      let left = window.screenX + (window.outerWidth - width) / 2;
                      let top = window.screenY + (window.outerHeight - height) / 2;
                      closePopup();
                      popupRef.current = window.open(
                        setupSession.url,
                        'provider-auth',
                        `width=${width},height=${height},left=${left},top=${top},popup=yes`
                      );
                    }
                  }}
                >
                  Reopen Popup
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
        return (
          <Flex direction="column" gap={6}>
            <Text size="2" weight="strong">
              {isOAuth ? 'Connect your account' : 'Start authentication'}
            </Text>
            <Text size="2" color="gray600">
              {isOAuth
                ? "A popup window will open for you to authorize access with the provider."
                : 'Click below to begin the authentication setup.'}
            </Text>
            {error && (
              <Text size="2" color="red600">
                {error}
              </Text>
            )}
            <Spacer size={6} />
            <Flex gap={8}>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetConnectState();
                  setStep(prev => prev - 1);
                }}
              >
                Back
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  {cancelLabel}
                </Button>
              )}
              <Button
                type="button"
                onClick={handleStartSetup}
                loading={isStarting || createSetupSession.isPending}
                disabled={!selectedMethodId}
              >
                {isOAuth ? 'Connect with OAuth' : 'Start Setup'}
              </Button>
            </Flex>
          </Flex>
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
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
          }
          popupRef.current = null;
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
              resetConnectState();
              resetCredentialsState();
              setStep(0);
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

  return <Stepper steps={steps} currentStep={step} setCurrentStep={setStep} />;
};
