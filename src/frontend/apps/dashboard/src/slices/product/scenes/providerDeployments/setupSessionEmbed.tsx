import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderAuthCredentials,
  useCreateProviderSetupSession,
  useGetProviderSetupSession,
  useProvider,
  useProviderAuthCredentials,
  useProviderAuthMethods,
  useProviderDeployment,
  type DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput,
  type DashboardInstanceProviderDeploymentsSetupSessionsGetOutput
} from '@metorial/state';
import { Button, Callout, Copy, Flex, Input, Select, Spacer, Text } from '@metorial/ui';
import { sortBy } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getProviderOAuthAutoRegistrationEnabled } from '../../lib/providerOAuthAutoRegistration';
import { Stepper } from '../stepper';

type CredentialsMode = 'existing' | 'new';
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

  let methodForm = useForm({
    initialValues: {
      selectedMethodId: initialMethodId ?? ''
    },
    onSubmit: async () => undefined,
    schema: yup =>
      yup.object({
        selectedMethodId: yup.string().required('Authentication method is required')
      })
  });
  let authMethods = useProviderAuthMethods(
    instanceId,
    effectiveVersionId ? { providerVersionId: effectiveVersionId } : null
  );
  let hasSingleMethod = (authMethods.data?.items?.length ?? 0) === 1;
  let selectedMethodId =
    methodForm.values.selectedMethodId ||
    (hasSingleMethod ? (authMethods.data?.items?.[0]?.id ?? '') : '');
  let authCredentials = useProviderAuthCredentials(
    instanceId,
    selectedMethodId
      ? {
          origin: ['custom', 'managed'],
          providerAuthMethodId: selectedMethodId
        }
      : {
          origin: ['custom']
        }
  );

  let createCredentials = useCreateProviderAuthCredentials();
  let createSetupSession = useCreateProviderSetupSession(instanceId, providerId, deploymentId);
  let getSetupSession = useGetProviderSetupSession(instanceId);
  let credentialsForm = useForm({
    initialValues: {
      credentialMode: 'existing' as CredentialsMode,
      selectedCredentialId: '',
      newCredName: '',
      newCredClientId: '',
      newCredClientSecret: ''
    },
    onSubmit: async values => {
      let providerAuthCredentialsId = values.selectedCredentialId;

      if (values.credentialMode === 'new') {
        providerAuthCredentialsId = (await handleCreateCredentials(values)) ?? '';
        if (!providerAuthCredentialsId) return;
      }

      let session = await handleStartSetup(providerAuthCredentialsId || undefined);
      if (session) {
        setStep(includeMethodStep ? 2 : 1);
      }
    },
    schema: yup =>
      yup.object({
        credentialMode: yup.string<CredentialsMode>().oneOf(['existing', 'new']).required(),
        selectedCredentialId: yup
          .string()
          .test(
            'selected-credential-required',
            'Select an existing credential or add your own to continue.',
            function (value) {
              if (this.parent.credentialMode !== 'existing') return true;
              return !!value;
            }
          ),
        newCredName: yup
          .string()
          .test('new-cred-name-required', 'Name is required', function (value) {
            if (this.parent.credentialMode !== 'new') return true;
            return !!value;
          }),
        newCredClientId: yup
          .string()
          .test('new-cred-client-id-required', 'Client ID is required', function (value) {
            if (this.parent.credentialMode !== 'new') return true;
            return !!value;
          }),
        newCredClientSecret: yup
          .string()
          .test(
            'new-cred-client-secret-required',
            'Client secret is required',
            function (value) {
              if (this.parent.credentialMode !== 'new') return true;
              return !!value;
            }
          )
      })
  });

  let [isStarting, setIsStarting] = useState(false);
  let [error, setError] = useState<string | null>(null);
  let [setupSession, setSetupSession] = useState<SetupSessionState | null>(null);
  let [step, setStep] = useState(hideMethodStep && showMethodStepInStepper ? 1 : 0);
  let [setupWindowBlocked, setSetupWindowBlocked] = useState(false);
  let autoStartedRef = useRef(false);

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
    autoStartedRef.current = false;
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
  let visibleAuthCredentials = sortBy(authCredentials.data?.items ?? [], [
    credential => Number(credential.isManaged),
    credential => Number(!credential.isDefault)
  ]);
  let hasManagedVisibleCredentials = visibleAuthCredentials.some(
    credential => credential.isManaged
  );
  let requiresManualOAuthCredentials = isOAuth && !oauthAutoRegistrationEnabled;
  let preferredVisibleCredential =
    visibleAuthCredentials.find(credential => !credential.isManaged && credential.isDefault) ??
    (visibleAuthCredentials.length === 1 && !visibleAuthCredentials[0].isManaged
      ? visibleAuthCredentials[0]
      : null);
  let isCreatingCredentials = credentialsForm.values.credentialMode === 'new';

  let skipMethodStep = hideMethodStep || hasSingleMethod;
  let showHiddenMethodStep = hideMethodStep && showMethodStepInStepper;
  let includeMethodStep = !skipMethodStep || showHiddenMethodStep;

  useEffect(() => {
    if (!selectedMethodId && hasSingleMethod) {
      methodForm.setFieldValue('selectedMethodId', authMethods.data!.items![0].id);
    }
  }, [authMethods.data?.items, hasSingleMethod, methodForm.setFieldValue, selectedMethodId]);

  let continueToCredentialsStep = async () => {
    methodForm.setFieldTouched('selectedMethodId', true, false);
    await methodForm.validateField('selectedMethodId');

    if (!methodForm.values.selectedMethodId) return;

    setStep(includeMethodStep ? 1 : 0);
  };

  useEffect(() => {
    if (!requiresManualOAuthCredentials) return;

    if (visibleAuthCredentials.length === 0) {
      if (credentialsForm.values.credentialMode !== 'new') {
        void credentialsForm.setFieldValue('credentialMode', 'new');
      }
      if (credentialsForm.values.selectedCredentialId) {
        void credentialsForm.setFieldValue('selectedCredentialId', '');
      }
      return;
    }

    if (credentialsForm.values.credentialMode === 'new') return;

    let selectedCredentialExists = visibleAuthCredentials.some(
      credential => credential.id === credentialsForm.values.selectedCredentialId
    );

    if (selectedCredentialExists) return;
    if (preferredVisibleCredential) {
      void credentialsForm.setFieldValue(
        'selectedCredentialId',
        preferredVisibleCredential.id
      );
      return;
    }

    if (credentialsForm.values.selectedCredentialId) {
      void credentialsForm.setFieldValue('selectedCredentialId', '');
    }
  }, [
    credentialsForm,
    credentialsForm.values.credentialMode,
    credentialsForm.values.selectedCredentialId,
    preferredVisibleCredential,
    requiresManualOAuthCredentials,
    visibleAuthCredentials
  ]);

  let handleCreateCredentials = async (values: {
    newCredName: string;
    newCredClientId: string;
    newCredClientSecret: string;
  }): Promise<string | null> => {
    let { newCredName, newCredClientId, newCredClientSecret } = values;
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

    void credentialsForm.setFieldValue('credentialMode', 'existing');
    void credentialsForm.setFieldValue('selectedCredentialId', result.id);
    void credentialsForm.setFieldValue('newCredName', '');
    void credentialsForm.setFieldValue('newCredClientId', '');
    void credentialsForm.setFieldValue('newCredClientSecret', '');
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

  // Auto-open the OAuth popup when reaching the connect step for auto-registration providers
  useEffect(() => {
    if (
      !setupSession &&
      !isStarting &&
      !autoStartedRef.current &&
      selectedMethodId &&
      isOAuth &&
      oauthAutoRegistrationEnabled &&
      skipMethodStep
    ) {
      autoStartedRef.current = true;
      void handleStartSetup();
    }
  }, [
    setupSession,
    isStarting,
    selectedMethodId,
    isOAuth,
    oauthAutoRegistrationEnabled,
    skipMethodStep
  ]);

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

  if (authCredentials.error) {
    return (
      <Flex direction="column" gap={12}>
        <Text size="2" color="red500">
          {authCredentials.error?.message ?? 'Failed to load authentication credentials.'}
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
        <form
          onSubmit={e => {
            e.preventDefault();
            void continueToCredentialsStep();
          }}
        >
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
              resetSetupSession();
            }}
            items={(authMethods.data?.items ?? []).map(method => ({
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
            <Button type="submit" disabled={!selectedMethodId}>
              Continue
            </Button>
          </Flex>
        </form>
      )
    };

    let credentialsStep = {
      title: 'Select',
      subtitle: 'Select existing or add credentials',
      render: () => (
        <form onSubmit={credentialsForm.handleSubmit}>
          <Text size="2" weight="strong">
            Select {oauthMethodName} Credentials
          </Text>
          <Text size="2" color="gray600">
            Auto-registration is disabled. Select existing credentials or add new credentials
            to continue.
          </Text>
          <Spacer size={6} />
          {!isCreatingCredentials && hasManagedVisibleCredentials && (
            <>
              <Callout color="blue">Managed by Metorial.</Callout>
              <Spacer size={8} />
            </>
          )}
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
            value={
              credentialsForm.values.credentialMode === 'new'
                ? '__create_new__'
                : credentialsForm.values.selectedCredentialId
            }
            placeholder="Select or add credentials"
            onChange={value => {
              setError(null);

              if (value === '__create_new__') {
                void credentialsForm.setFieldValue('credentialMode', 'new');
                void credentialsForm.setFieldValue('selectedCredentialId', '');
              } else {
                void credentialsForm.setFieldValue('credentialMode', 'existing');
                void credentialsForm.setFieldValue('selectedCredentialId', value);
              }
            }}
            items={[
              ...visibleAuthCredentials.map(cred => ({
                id: cred.id,
                label: cred.isManaged
                  ? `${cred.name || cred.id} (Managed by Metorial)`
                  : cred.isDefault
                    ? cred.name || `Default ${oauthMethodName} credentials`
                    : cred.name || cred.id
              })),
              ...(visibleAuthCredentials.length > 0 ? [{ type: 'separator' as const }] : []),
              {
                id: '__create_new__',
                label: 'Add credentials'
              }
            ]}
          />
          <credentialsForm.RenderError field="selectedCredentialId" />
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
            {(!skipMethodStep ||
              (isCreatingCredentials && visibleAuthCredentials.length > 0) ||
              onBackToMethodSelection) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isCreatingCredentials && visibleAuthCredentials.length > 0) {
                    void credentialsForm.setFieldValue('credentialMode', 'existing');
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
              type="submit"
              loading={
                createCredentials.isPending || isStarting || createSetupSession.isPending
              }
              disabled={
                (isCreatingCredentials &&
                  (!credentialsForm.values.newCredName ||
                    !credentialsForm.values.newCredClientId ||
                    !credentialsForm.values.newCredClientSecret)) ||
                (!isCreatingCredentials && !credentialsForm.values.selectedCredentialId)
              }
            >
              Continue
            </Button>
          </Flex>
        </form>
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
                  size="1"
                  onClick={() => {
                    let opened = openSetupWindow(setupSession.url!);
                    setSetupWindowBlocked(!opened);
                  }}
                >
                  Open Window
                </Button>
                {onCancel && (
                  <Button size="1" variant="outline" onClick={onCancel}>
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
                ? `A separate window will open so you can authorize ${providerName}.`
                : 'Start the setup session for this authentication method.'}
            </Text>
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
            <Flex gap={8} align="center">
              <Button
                type="button"
                size="1"
                onClick={() =>
                  void handleStartSetup(
                    credentialsForm.values.selectedCredentialId || undefined
                  )
                }
                loading={isStarting || createSetupSession.isPending}
                disabled={!selectedMethodId}
              >
                {isOAuth ? 'Open Window' : 'Start Setup'}
              </Button>
              {(step > 0 || (skipMethodStep && onBackToMethodSelection)) && (
                <Button
                  type="button"
                  size="1"
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
                <Button type="button" size="1" variant="outline" onClick={onCancel}>
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

  if (steps.length <= 1) {
    return <>{steps[0]?.render()}</>;
  }

  return <Stepper steps={steps} currentStep={step} setCurrentStep={handleStepChange} />;
};
