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
import { Button, Flex, Input, Select, Spacer, Text } from '@metorial/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  cancelLabel = 'Cancel'
}: {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  onComplete: (
    setupSession: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput | null
  ) => void;
  onCancel?: () => void;
  cancelLabel?: string;
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

  let methodForm = useForm({
    initialValues: {
      selectedMethodId: ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        selectedMethodId: yup.string().required('Authentication method is required')
      })
  });
  let credentialsForm = useForm({
    initialValues: {
      selectedCredentialsId: '',
      newCredName: '',
      newCredClientId: '',
      newCredClientSecret: ''
    },
    schemaDependencies: [isCreatingCredentials],
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        selectedCredentialsId: yup.string().defined(),
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
  let [step, setStep] = useState(0);
  let [setupWindowBlocked, setSetupWindowBlocked] = useState(false);

  let selectedMethodId = methodForm.values.selectedMethodId;
  let selectedCredentialsId = credentialsForm.values.selectedCredentialsId;

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

  let selectedMethod = useMemo(
    () =>
      (authMethods.data?.items ?? []).find(m => m.id === selectedMethodId),
    [authMethods.data?.items, selectedMethodId]
  );

  let isOAuth = selectedMethod?.type === 'oauth';

  let hasSingleMethod = (authMethods.data?.items?.length ?? 0) === 1;

  useEffect(() => {
    if (!selectedMethodId && hasSingleMethod) {
      methodForm.setFieldValue('selectedMethodId', authMethods.data!.items![0].id);
    }
  }, [
    authMethods.data?.items,
    hasSingleMethod,
    methodForm.setFieldValue,
    selectedMethodId
  ]);

  let handleCreateCredentials = async (): Promise<boolean> => {
    let { newCredName, newCredClientId, newCredClientSecret } = credentialsForm.values;
    if (!newCredName || !newCredClientId || !newCredClientSecret) return false;
    if (!selectedMethod) return false;

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
      return false;
    }

    if (!result) return false;

    credentialsForm.setFieldValue('selectedCredentialsId', result.id);
    credentialsForm.setFieldValue('newCredName', '');
    credentialsForm.setFieldValue('newCredClientId', '');
    credentialsForm.setFieldValue('newCredClientSecret', '');
    setIsCreatingCredentials(false);
    return true;
  };

  let handleStartSetup = async () => {
    if (!selectedMethodId) return;

    setError(null);
    setSetupWindowBlocked(false);
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
      providerAuthCredentialsId: selectedCredentialsId || undefined
    });

    setIsStarting(false);

    if (err) {
      if (setupWindowRef.current && !setupWindowRef.current.closed) {
        setupWindowRef.current.close();
      }
      setupWindowRef.current = null;
      console.error('Failed to create setup session:', err);
      return;
    }

    if (session) {
      completedRef.current = false;
      pollingRef.current = false;
      setSetupSession(session);

      if (session.url) {
        let opened = openSetupWindow(session.url);
        setSetupWindowBlocked(!opened);
      }
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
    deployment.isLoading ||
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

  if (deployment.error) {
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

  if (!deployment.data) {
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
      title: 'Method',
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
              setIsCreatingCredentials(false);
              setError(null);
            }}
            items={(authMethods.data?.items ?? []).map((method: AuthMethod) => ({
              id: method.id,
              label: `${method.name} (${method.type})`
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
            <Button type="button" onClick={() => setStep(1)} disabled={!selectedMethodId}>
              Continue
            </Button>
          </Flex>
        </>
      )
    };

    let connectStepIndex = hasSingleMethod ? 1 : 2;
    let handleCredentialsContinue = async () => {
      if (isCreatingCredentials) {
        let ok = await handleCreateCredentials();
        if (!ok) return;
      }
      setStep(connectStepIndex);
      await handleStartSetup();
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
            value={
              isCreatingCredentials
                ? '__create_new__'
                : (selectedCredentialsId ||
                    (authCredentials.data?.items ?? []).find(c => c.isDefault)?.id ||
                    '__use_default_credentials__')
            }
            placeholder="Use default credentials"
            onChange={value => {
              if (value === '__create_new__') {
                setIsCreatingCredentials(true);
                credentialsForm.setFieldValue('selectedCredentialsId', '');
              } else if (value === '__use_default_credentials__') {
                setIsCreatingCredentials(false);
                credentialsForm.setFieldValue('selectedCredentialsId', '');
              } else {
                setIsCreatingCredentials(false);
                credentialsForm.setFieldValue('selectedCredentialsId', value);
              }
            }}
            items={[
              ...((authCredentials.data?.items ?? []).some(c => c.isDefault)
                ? []
                : [{ id: '__use_default_credentials__', label: 'Use default credentials' }]),
              ...(authCredentials.data?.items ?? []).map((cred: AuthCredential) => ({
                id: cred.id,
                label: cred.isDefault ? (cred.name || 'Default credentials') : (cred.name || cred.id)
              })),
              {
                id: '__create_new__',
                label: 'Add your own credentials'
              }
            ]}
          />
          {isCreatingCredentials && (
            <>
              <Spacer size={8} />
              <Input
                label="Name"
                value={credentialsForm.values.newCredName}
                onChange={e =>
                  credentialsForm.setFieldValue('newCredName', e.target.value)
                }
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
            {(!hasSingleMethod || isCreatingCredentials) && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  isCreatingCredentials ? setIsCreatingCredentials(false) : setStep(0)
                }
              >
                Back
              </Button>
            )}
            <Button
              type="button"
              onClick={handleCredentialsContinue}
              loading={createCredentials.isPending}
              disabled={
                isCreatingCredentials &&
                (!credentialsForm.values.newCredName ||
                  !credentialsForm.values.newCredClientId ||
                  !credentialsForm.values.newCredClientSecret)
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
                Continue in the authentication window
              </Text>
              <Text size="2" color="gray600">
                Complete the provider sign-in flow in the popup window. This modal will update
                automatically when authentication finishes.
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
                  Open Authentication Window
                </Button>
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    {cancelLabel}
                  </Button>
                )}
              </Flex>
              {!hasSingleMethod && (
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSetupSession(null);
                    pollingRef.current = false;
                    setSetupWindowBlocked(false);
                  }}
                >
                  <Text size="1" color="gray500" style={{ textDecoration: 'underline' }}>
                    Change method
                  </Text>
                </span>
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
              {isOAuth ? 'Start OAuth authentication' : 'Start setup'}
            </Text>
            <Text size="2" color="gray600">
              {isOAuth
                ? 'A separate authentication window will open so you can authorize this deployment.'
                : 'Start the setup session for this authentication method.'}
            </Text>
            <Spacer size={6} />
            <Button
              type="button"
              onClick={handleStartSetup}
              loading={isStarting || createSetupSession.isPending}
              disabled={!selectedMethodId}
            >
              {isOAuth ? 'Open Authentication Window' : 'Start Setup'}
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
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(prev => prev - 1)}
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
      return hasSingleMethod ? [credentialsStep, connectStep] : [methodStep, credentialsStep, connectStep];
    }
    return hasSingleMethod
      ? [{ ...connectStep, subtitle: 'Start setup' }]
      : [
          methodStep,
          {
            ...connectStep,
            subtitle: 'Start setup'
          }
        ];
  })();

  return <Stepper steps={steps} currentStep={step} setCurrentStep={setStep} />;
};
