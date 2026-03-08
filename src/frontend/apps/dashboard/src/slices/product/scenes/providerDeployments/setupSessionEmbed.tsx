import type {
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput,
  DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput,
  DashboardInstanceProviderDeploymentsSetupSessionsGetOutput,
  DashboardInstanceProvidersAuthMethodsListOutput
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderAuthCredentials,
  useProviderDeployment,
  useProvider,
  useCreateProviderSetupSession,
  useGetProviderSetupSession,
  useProviderAuthCredentials,
  useProviderAuthMethods
} from '@metorial/state';
import { Button, Copy, Flex, Input, Select, Spacer, Text } from '@metorial/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getProviderOAuthAutoRegistrationEnabled } from '../../lib/providerOAuthAutoRegistration';
import { Stepper } from '../stepper';

type AuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];
type AuthCredential =
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput['items'][number];
type SetupSessionState =
  | DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput
  | DashboardInstanceProviderDeploymentsSetupSessionsGetOutput;

export let ProviderSetupSessionEmbed = ({
  instanceId,
  providerId,
  deploymentId,
  onComplete,
  onCancel,
  cancelLabel = 'Cancel',
  initialMethodId,
  hideMethodStep = false,
  onBackToMethodSelection,
  showMethodStepInStepper = false
}: {
  instanceId: string;
  providerId: string;
  deploymentId?: string;
  onComplete: (
    setupSession: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput | null
  ) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  initialMethodId?: string;
  hideMethodStep?: boolean;
  onBackToMethodSelection?: () => void;
  showMethodStepInStepper?: boolean;
}) => {
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let lockedVersionId = deployment.data?.lockedVersion?.id;
  let provider = useProvider(instanceId, providerId);
  let effectiveVersionId = lockedVersionId ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(instanceId, effectiveVersionId);
  let authCredentials = useProviderAuthCredentials(instanceId, providerId);

  let createCredentials = useCreateProviderAuthCredentials();
  let createSetupSession = useCreateProviderSetupSession(instanceId, providerId, deploymentId);
  let getSetupSession = useGetProviderSetupSession(instanceId);
  let [isCreatingCredentials, setIsCreatingCredentials] = useState(false);
  let [selectedCredentialsId, setSelectedCredentialsId] = useState<string | undefined>(undefined);
  let selectedCredentialsIdRef = useRef<string | undefined>(undefined);

  let methodForm = useForm({
    initialValues: {
      selectedMethodId: initialMethodId ?? ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        selectedMethodId: yup.string().required('Authentication method is required')
      })
  });
  let credentialsForm = useForm({
    initialValues: {
      newCredName: '',
      newCredClientId: '',
      newCredClientSecret: ''
    },
    schemaDependencies: [isCreatingCredentials],
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        newCredName: isCreatingCredentials
          ? yup.string().required('Name is required')
          : yup.string().defined(),
        newCredClientId: isCreatingCredentials
          ? yup.string().required('Client ID is required')
          : yup.string().defined(),
        newCredClientSecret: isCreatingCredentials
          ? yup.string().required('Client secret is required')
          : yup.string().defined()
      })
  });

  let [isStarting, setIsStarting] = useState(false);
  let [error, setError] = useState<string | null>(null);
  let [setupSession, setSetupSession] = useState<SetupSessionState | null>(null);
  let [step, setStep] = useState(hideMethodStep && showMethodStepInStepper ? 1 : 0);
  let [setupWindowBlocked, setSetupWindowBlocked] = useState(false);

  let selectedMethodId = methodForm.values.selectedMethodId;

  let completedRef = useRef(false);
  let pollingRef = useRef(false);
  let onCompleteRef = useRef(onComplete);
  let getSetupSessionRef = useRef(getSetupSession);
  let setupWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    getSetupSessionRef.current = getSetupSession;
  }, [getSetupSession]);

  let openSetupWindow = (url: string) => {
    if (typeof window === 'undefined') return false;

    let popup = setupWindowRef.current;
    if (!popup || popup.closed) {
      popup = window.open('', 'metorial_provider_setup', 'popup,width=560,height=760');
      setupWindowRef.current = popup;
    }

    if (!popup) return false;

    try {
      popup.location.href = url;
      popup.focus();
      return true;
    } catch {
      return false;
    }
  };

  let resetSetupSession = () => {
    if (setupWindowRef.current && !setupWindowRef.current.closed) {
      setupWindowRef.current.close();
    }

    setupWindowRef.current = null;
    completedRef.current = false;
    pollingRef.current = false;
    setSetupSession(null);
    setSetupWindowBlocked(false);
    setError(null);
  };

  let selectedMethod = useMemo(
    () => (authMethods.data?.items ?? []).find(m => m.id === selectedMethodId),
    [authMethods.data?.items, selectedMethodId]
  );
  let providerName = deployment.data?.name ?? provider.data?.name ?? providerId;
  let oauthMethodName = selectedMethod?.name ?? 'OAuth';
  let redirectUri = provider.data?.oauth?.callbackUrl;
  let isOAuth = selectedMethod?.type === 'oauth';
  let oauthAutoRegistrationEnabled = getProviderOAuthAutoRegistrationEnabled(provider.data);
  let visibleAuthCredentials = isOAuth
    ? (authCredentials.data?.items ?? []).filter(credential => !credential.isDefault)
    : (authCredentials.data?.items ?? []);
  let requiresManualOAuthCredentials = isOAuth && !oauthAutoRegistrationEnabled;
  let preferredVisibleCredential =
    visibleAuthCredentials.find(credential => credential.isDefault) ??
    (visibleAuthCredentials.length === 1 ? visibleAuthCredentials[0] : null);
  let effectiveSelectedCredentialsId = isCreatingCredentials
    ? undefined
    : (selectedCredentialsId ?? preferredVisibleCredential?.id);

  let hasSingleMethod = (authMethods.data?.items?.length ?? 0) === 1;
  let skipMethodStep = hideMethodStep || hasSingleMethod;
  let showHiddenMethodStep = hideMethodStep && showMethodStepInStepper;
  let includeMethodStep = !skipMethodStep || showHiddenMethodStep;

  useEffect(() => {
    if (!selectedMethodId && hasSingleMethod) {
      methodForm.setFieldValue('selectedMethodId', authMethods.data!.items![0].id);
    }
  }, [authMethods.data?.items, hasSingleMethod, methodForm.setFieldValue, selectedMethodId]);

  useEffect(() => {
    if (!requiresManualOAuthCredentials) return;
    if (visibleAuthCredentials.length > 0) return;
    if (selectedCredentialsId) return;

    setIsCreatingCredentials(true);
  }, [requiresManualOAuthCredentials, selectedCredentialsId, visibleAuthCredentials.length]);

  useEffect(() => {
    if (isCreatingCredentials) return;
    if (selectedCredentialsId) {
      selectedCredentialsIdRef.current = selectedCredentialsId;
      return;
    }
    if (!preferredVisibleCredential) return;

    setSelectedCredentialsId(preferredVisibleCredential.id);
    selectedCredentialsIdRef.current = preferredVisibleCredential.id;
  }, [isCreatingCredentials, preferredVisibleCredential, selectedCredentialsId]);

  let handleCreateCredentials = async (): Promise<string | null> => {
    let { newCredName, newCredClientId, newCredClientSecret } = credentialsForm.values;
    if (!newCredName || !newCredClientId || !newCredClientSecret) return null;
    if (!selectedMethod) return null;

    setError(null);

    let [result, err] = await createCredentials.mutate({
      instanceId,
      providerId,
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
      return null;
    }

    if (!result) return null;

    setSelectedCredentialsId(result.id);
    selectedCredentialsIdRef.current = result.id;
    credentialsForm.setFieldValue('newCredName', '');
    credentialsForm.setFieldValue('newCredClientId', '');
    credentialsForm.setFieldValue('newCredClientSecret', '');
    setIsCreatingCredentials(false);
    return result.id;
  };

  let handleStartSetup = async (providerAuthCredentialsId?: string) => {
    if (!selectedMethodId) return null;

    resetSetupSession();
    setIsStarting(true);

    if (isOAuth && typeof window !== 'undefined') {
      setupWindowRef.current = window.open(
        '',
        'metorial_provider_setup',
        'popup,width=560,height=760'
      );
    }

    let [session, err] = await createSetupSession.mutate({
      providerAuthMethodId: selectedMethodId,
      providerAuthCredentialsId
    });

    setIsStarting(false);

    if (err) {
      if (setupWindowRef.current && !setupWindowRef.current.closed) {
        setupWindowRef.current.close();
      }
      setupWindowRef.current = null;
      let errorMessage =
        'response' in err
          ? (err as { response?: { message?: string } }).response?.message
          : 'message' in err
            ? String((err as { message?: string }).message ?? '')
            : 'Failed to create setup session.';
      setError(errorMessage ?? 'Failed to create setup session.');
      console.error('Failed to create setup session:', err);
      return null;
    }

    if (session) {
      setSetupSession(session);

      if (session.url) {
        let opened = openSetupWindow(session.url);
        setSetupWindowBlocked(!opened);
      }
    }

    return session ?? null;
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
        if (res) setSetupSession(res);

        if (res?.status === 'completed') {
          completedRef.current = true;
          if (setupWindowRef.current && !setupWindowRef.current.closed) {
            setupWindowRef.current.close();
            setupWindowRef.current = null;
          }
          onCompleteRef.current(res);
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

  if (
    (!!deploymentId && deployment.isLoading) ||
    (!lockedVersionId && provider.isLoading) ||
    (effectiveVersionId ? authMethods.isLoading : false) ||
    authCredentials.isLoading
  ) {
    return (
      <Text size="2" color="gray600">
        Loading authentication methods...
      </Text>
    );
  }

  if (deploymentId && deployment.error) {
    return (
      <Flex direction="column" gap={12}>
        <Text size="2" color="red500">
          {deployment.error.message ?? 'Failed to load deployment.'}
        </Text>
        <Flex gap={10}>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button onClick={() => onComplete(null)}>Close</Button>
        </Flex>
      </Flex>
    );
  }

  if (deploymentId && !deployment.data) {
    return (
      <Text size="2" color="gray600">
        Loading deployment details...
      </Text>
    );
  }

  if (!lockedVersionId && provider.error) {
    return (
      <Flex direction="column" gap={12}>
        <Text size="2" color="red500">
          {provider.error.message ?? 'Failed to load provider details.'}
        </Text>
        <Flex gap={10}>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button onClick={() => onComplete(null)}>Close</Button>
        </Flex>
      </Flex>
    );
  }

  if (!effectiveVersionId) {
    return (
      <Flex direction="column" gap={12}>
        <Text size="2" color="gray600">
          No provider version is available yet, so authentication cannot be configured.
        </Text>
        <Flex gap={10}>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button onClick={() => onComplete(null)}>Close</Button>
        </Flex>
      </Flex>
    );
  }

  if (authMethods.error) {
    return (
      <Flex direction="column" gap={12}>
        <Text size="2" color="red500">
          {authMethods.error.message ?? 'Failed to load authentication methods.'}
        </Text>
        <Flex gap={10}>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button onClick={() => onComplete(null)}>Close</Button>
        </Flex>
      </Flex>
    );
  }

  if (!authMethods.data?.items?.length) {
    return (
      <Flex direction="column" gap={12}>
        <Text size="2" color="gray600">
          This provider does not require authentication.
        </Text>
        <Flex gap={10}>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button onClick={() => onComplete(null)}>Close</Button>
        </Flex>
      </Flex>
    );
  }

  if (setupSession && !setupSession.url) {
    return (
      <Flex direction="column" gap={12}>
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

  let steps = (() => {
    let methodStep = {
      title: 'Authentication',
      subtitle: 'Select auth method',
      render: () => (
        <>
          {!lockedVersionId && (
            <>
              <Text size="1" color="gray600">
                This deployment is not pinned. Authentication methods are being loaded from the
                provider&apos;s current version.
              </Text>
              <Spacer size={6} />
            </>
          )}
          <Select
            label="Authentication Method"
            value={selectedMethodId}
            placeholder="Select an authentication method..."
            onChange={value => {
              methodForm.setFieldValue('selectedMethodId', value);
              credentialsForm.resetForm();
              setSelectedCredentialsId(undefined);
              selectedCredentialsIdRef.current = undefined;
              setIsCreatingCredentials(false);
              resetSetupSession();
            }}
            items={(authMethods.data?.items ?? []).map((method: AuthMethod) => ({
              id: method.id,
              label: method.name
            }))}
          />
          <methodForm.RenderError field="selectedMethodId" />
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
            <Button
              type="button"
              onClick={() => setStep(includeMethodStep ? 1 : 0)}
              disabled={!selectedMethodId}
            >
              Continue
            </Button>
          </Flex>
        </>
      )
    };

    let connectStepIndex = includeMethodStep ? 2 : 1;
    let handleCredentialsContinue = async () => {
      let providerAuthCredentialsId =
        selectedCredentialsIdRef.current ?? effectiveSelectedCredentialsId;

      if (isCreatingCredentials) {
        providerAuthCredentialsId = (await handleCreateCredentials()) ?? undefined;
      }

      if (requiresManualOAuthCredentials && !providerAuthCredentialsId) {
        setError('Select an existing credential or add your own to continue.');
        return;
      }

      let session = await handleStartSetup(providerAuthCredentialsId);
      if (session) {
        setStep(connectStepIndex);
      }
    };

    let credentialsStep = {
      title: 'Select',
      subtitle: 'Select existing or add credentials',
      render: () => (
        <>
          <Text size="2" weight="strong">
            Select {oauthMethodName} Credentials
          </Text>
          <Text size="2" color="gray600">
            Auto-registration is disabled. Select existing credentials or add new
            credentials to continue.
          </Text>
          <Spacer size={6} />
          {redirectUri && isCreatingCredentials && (
            <>
              <Copy label="Redirect URI" value={redirectUri} />
              <Text size="1" color="gray600">
                Use this redirect URI when configuring your OAuth app.
              </Text>
              <Spacer size={8} />
            </>
          )}
          <Select
            label={`${oauthMethodName} Existing Credentials`}
            value={isCreatingCredentials ? '__create_new__' : effectiveSelectedCredentialsId}
            placeholder="Select or add credentials"
            onChange={value => {
              setError(null);

              if (value === '__create_new__') {
                setIsCreatingCredentials(true);
                setSelectedCredentialsId(undefined);
                selectedCredentialsIdRef.current = undefined;
              } else {
                setIsCreatingCredentials(false);
                setSelectedCredentialsId(value);
                selectedCredentialsIdRef.current = value;
              }
            }}
            items={[
              ...visibleAuthCredentials.map((cred: AuthCredential) => ({
                id: cred.id,
                label: cred.isDefault
                  ? cred.name || `Default ${oauthMethodName} credentials`
                  : cred.name || cred.id
              })),
              {
                id: '__create_new__',
                label: 'Add credentials'
              }
            ]}
          />
          {isCreatingCredentials && (
            <>
              <Spacer size={8} />
              <Input
                label="Name"
                value={credentialsForm.values.newCredName}
                onChange={e => credentialsForm.setFieldValue('newCredName', e.target.value)}
                placeholder="My OAuth App"
                required
              />
              <credentialsForm.RenderError field="newCredName" />
              <Spacer size={8} />
              <Input
                label="Client ID"
                value={credentialsForm.values.newCredClientId}
                onChange={e =>
                  credentialsForm.setFieldValue('newCredClientId', e.target.value)
                }
                placeholder="Enter client ID from provider"
                required
              />
              <credentialsForm.RenderError field="newCredClientId" />
              <Spacer size={8} />
              <Input
                label="Client Secret"
                value={credentialsForm.values.newCredClientSecret}
                onChange={e =>
                  credentialsForm.setFieldValue('newCredClientSecret', e.target.value)
                }
                placeholder="Enter client secret from provider"
                type="password"
                required
              />
              <credentialsForm.RenderError field="newCredClientSecret" />
            </>
          )}
          <createCredentials.RenderError />
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
            {(!skipMethodStep || isCreatingCredentials || onBackToMethodSelection) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isCreatingCredentials) {
                    setIsCreatingCredentials(false);
                    return;
                  }

                  if (skipMethodStep) {
                    onBackToMethodSelection?.();
                    return;
                  }

                  setStep(0);
                }}
              >
                Back
              </Button>
            )}
            <Button
              type="button"
              onClick={handleCredentialsContinue}
              loading={createCredentials.isPending}
              disabled={
                (isCreatingCredentials &&
                  (!credentialsForm.values.newCredName ||
                    !credentialsForm.values.newCredClientId ||
                    !credentialsForm.values.newCredClientSecret)) ||
                (!isCreatingCredentials &&
                  requiresManualOAuthCredentials &&
                  !effectiveSelectedCredentialsId)
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
                Continue in the {oauthMethodName} window
              </Text>
              <Text size="2" color="gray600">
                Complete the sign-in flow. This modal will update automatically when
                authentication finishes.
              </Text>
              {setupWindowBlocked && (
                <>
                  <Spacer size={5} />
                  <Text size="2" color="red600">
                    The popup window was blocked by your browser. Open it manually to continue.
                  </Text>
                </>
              )}
              <Spacer size={8} />
              <Flex gap={8} align="center">
                <Button
                  onClick={() => {
                    let opened = openSetupWindow(setupSession.url!);
                    setSetupWindowBlocked(!opened);
                  }}
                >
                  Open Window
                </Button>
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    {cancelLabel}
                  </Button>
                )}
              </Flex>
              {(!skipMethodStep || onBackToMethodSelection) && (
                <>
                  <Spacer size={8} />
                  <span
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (skipMethodStep) {
                        resetSetupSession();
                        onBackToMethodSelection?.();
                      } else {
                        resetSetupSession();
                      }
                    }}
                  >
                    <Text size="1" color="gray500" style={{ textDecoration: 'underline' }}>
                      Change method
                    </Text>
                  </span>
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
            </>
          );
        }
        return (
          <>
            <Text size="2" weight="strong">
              {isOAuth ? `Start ${oauthMethodName}` : 'Start setup'}
            </Text>
            <Text size="2" color="gray600">
              {isOAuth
                ? `A separate ${oauthMethodName} window will open so you can authorize ${providerName}.`
                : 'Start the setup session for this authentication method.'}
            </Text>
            <Spacer size={6} />
            <Button
              type="button"
              onClick={() =>
                void handleStartSetup(
                  selectedCredentialsIdRef.current ?? effectiveSelectedCredentialsId
                )
              }
              loading={isStarting || createSetupSession.isPending}
              disabled={!selectedMethodId}
            >
              {isOAuth ? `Open ${oauthMethodName} Window` : 'Start Setup'}
            </Button>
            <createSetupSession.RenderError />
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
              {(step > 0 || (skipMethodStep && onBackToMethodSelection)) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (step > 0) {
                      setStep(prev => prev - 1);
                      return;
                    }
                    onBackToMethodSelection?.();
                  }}
                >
                  Back
                </Button>
              )}
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
      if (oauthAutoRegistrationEnabled) {
        return includeMethodStep
          ? [
              methodStep,
              {
                ...connectStep,
                subtitle: 'Complete authentication'
              }
            ]
          : [connectStep];
      }

      return includeMethodStep
        ? [methodStep, credentialsStep, connectStep]
        : [credentialsStep, connectStep];
    }
    return includeMethodStep
      ? [
          methodStep,
          {
            ...connectStep,
            subtitle: 'Start setup'
          }
        ]
      : [{ ...connectStep, subtitle: 'Start setup' }];
  })();

  let handleStepChange = (nextStep: number) => {
    if (showHiddenMethodStep && nextStep === 0) {
      onBackToMethodSelection?.();
      return;
    }

    setStep(nextStep);
  };

  return <Stepper steps={steps} currentStep={step} setCurrentStep={handleStepChange} />;
};
