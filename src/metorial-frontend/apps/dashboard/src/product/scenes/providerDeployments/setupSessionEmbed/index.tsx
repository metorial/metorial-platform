import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderAuthCredentials,
  useCreateProviderSetupSession,
  useCurrentProject,
  useGetProviderSetupSession,
  useProjectBrand,
  useProvider,
  useProviderAuthCredentials,
  useProviderAuthMethods,
  useProviderDeployment,
  useProviderListing
} from '@metorial/state';
import { Button, Flex, Text } from '@metorial/ui';
import { sortBy } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stepper } from '@metorial/explainer';
import { getAuthMethodOAuthDoc } from '../../../lib/providerDocs';
import { getProviderOAuthAutoRegistrationEnabled } from '../../../lib/providerOAuthAutoRegistration';
import {
  ConnectStep,
  CredentialsSelectionStep,
  FlatOAuthConnectStep,
  MethodSelectionStep,
  MissingSetupWindowState,
  SetupStateMessage,
  type SetupStep
} from './stepContent';
import type {
  CredentialsMode,
  ProviderSetupSessionEmbedProps,
  SetupSessionState
} from './types';

export let ProviderSetupSessionEmbed = ({
  instanceId,
  providerId,
  deploymentId,
  fixedCredentialId,
  onComplete,
  onCancel,
  cancelLabel = 'Cancel',
  onWindowOpenCancel,
  windowOpenCancelLabel = 'Cancel',
  onWindowOpenStateChange,
  initialMethodId,
  hideMethodStep = false,
  onBackToMethodSelection,
  showMethodStepInStepper = false,
  hideCredentialsIntro = false,
  flattenOAuthCredentialsFlow = false,
  showExternalPreviewSidebar = false,
  collectAuthConfigDetails = false,
  initialAuthConfigDetails,
  autoStartManagedCredentialSetup = false,
  onAuthConfigDetailsChange,
  onPreviewCredentialTypeChange,
  onPreviewModeChange,
  onActiveStepChange
}: ProviderSetupSessionEmbedProps) => {
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let lockedVersionId = deployment.data?.lockedVersion?.id;
  let provider = useProvider(instanceId, providerId);
  let providerListing = useProviderListing(instanceId, providerId);
  let project = useCurrentProject();
  let projectBrand = useProjectBrand(project.data?.organization.id, project.data?.id);
  let effectiveVersionId = lockedVersionId ?? provider.data?.currentVersion?.id;

  let methodForm = useForm({
    initialValues: {
      selectedMethodId: initialMethodId ?? ''
    },
    onSubmit: async values => {
      if (!values.selectedMethodId) return;
      setStep(includeMethodStep ? 1 : 0);
    },
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
          providerId,
          providerAuthMethodId: selectedMethodId
        }
      : {
          providerId,
          origin: ['custom']
        }
  );

  let createCredentials = useCreateProviderAuthCredentials();
  let createSetupSession = useCreateProviderSetupSession(instanceId, providerId, deploymentId);
  let getSetupSession = useGetProviderSetupSession(instanceId);

  let credentialsForm = useForm({
    initialValues: {
      credentialMode: 'existing' as CredentialsMode,
      selectedCredentialId: fixedCredentialId ?? '',
      newCredName: '',
      newCredClientId: '',
      newCredClientSecret: ''
    },
    onSubmit: async () => {
      let providerAuthCredentialsId = await resolveSelectedCredentialId();
      if (!providerAuthCredentialsId) return;

      setStep(connectStepIndex);
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

  let authConfigDetailsForm = useForm({
    initialValues: {
      name: initialAuthConfigDetails?.name ?? '',
      description: initialAuthConfigDetails?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async () => undefined,
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure()
      })
  });

  let [isStarting, setIsStarting] = useState(false);
  let [error, setError] = useState<string | null>(null);
  let [setupSession, setSetupSession] = useState<SetupSessionState | null>(null);
  let [step, setStep] = useState(hideMethodStep && showMethodStepInStepper ? 1 : 0);
  let [setupWindowBlocked, setSetupWindowBlocked] = useState(false);
  let [latestCreatedCredentialId, setLatestCreatedCredentialId] = useState<string | null>(null);
  let [latestCreatedCredentialLabel, setLatestCreatedCredentialLabel] = useState<string | null>(
    null
  );

  let autoStartedRef = useRef(false);
  let autoStartedManagedSetupRef = useRef(false);
  let autoCredentialModeRef = useRef(false);
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

  let selectedMethod = useMemo(
    () => (authMethods.data?.items ?? []).find(method => method.id === selectedMethodId),
    [authMethods.data?.items, selectedMethodId]
  );

  let providerName = deployment.data?.name ?? provider.data?.name ?? providerId;
  let oauthMethodName = selectedMethod?.name ?? 'OAuth';
  let redirectUri = provider.data?.oauth?.callbackUrl;
  let isOAuth = selectedMethod?.type === 'oauth';
  let oauthAutoRegistrationEnabled = getProviderOAuthAutoRegistrationEnabled(provider.data);
  let projectBrandImageUrl = projectBrand.data?.imageUrl;
  let projectBrandName = projectBrand.data?.name ?? project.data?.name ?? 'Metorial';
  let providerImageUrl = provider.data?.publisher.imageUrl;
  let oauthDoc = getAuthMethodOAuthDoc(providerListing.data, selectedMethod);

  let visibleAuthCredentials = sortBy(authCredentials.data?.items ?? [], [
    credential => Number(!credential.isManaged),
    credential => Number(!credential.isDefault),
    credential => credential.name ?? credential.id
  ]);
  let managedVisibleCredentials = visibleAuthCredentials.filter(credential => credential.isManaged);
  let customVisibleCredentials = visibleAuthCredentials.filter(credential => !credential.isManaged);
  let hasManagedVisibleCredentials = visibleAuthCredentials.some(credential => credential.isManaged);
  let requiresManualOAuthCredentials = isOAuth && !oauthAutoRegistrationEnabled;
  let preferredVisibleCredential =
    managedVisibleCredentials.find(credential => credential.isDefault) ??
    managedVisibleCredentials[0] ??
    customVisibleCredentials.find(credential => credential.isDefault) ??
    customVisibleCredentials[0] ??
    (visibleAuthCredentials.length === 1 ? visibleAuthCredentials[0] : null);
  let effectiveSelectedCredentialId =
    fixedCredentialId ||
    (credentialsForm.values.credentialMode === 'new'
      ? ''
      : credentialsForm.values.selectedCredentialId || preferredVisibleCredential?.id || '');
  let selectedVisibleCredential = visibleAuthCredentials.find(
    credential => credential.id === effectiveSelectedCredentialId
  );
  let credentialSelectItems = fixedCredentialId
    ? [
        {
          id: fixedCredentialId,
          label: selectedVisibleCredential?.name ?? selectedVisibleCredential?.id ?? fixedCredentialId
        }
      ]
    : [
        ...(managedVisibleCredentials.length > 0
          ? [
              {
                id: '__managed_heading__',
                label: 'Metorial Managed',
                disabled: true
              } as const,
              ...managedVisibleCredentials.map(credential => ({
                id: credential.id,
                label: `${credential.name || credential.id} (Metorial Managed)`
              }))
            ]
          : []),
        ...(managedVisibleCredentials.length > 0 && customVisibleCredentials.length > 0
          ? [{ type: 'separator' as const }]
          : []),
        ...(customVisibleCredentials.length > 0
          ? [
              {
                id: '__custom_heading__',
                label: 'Your credentials',
                disabled: true
              } as const,
              ...customVisibleCredentials.map(credential => ({
                id: credential.id,
                label: credential.isDefault
                  ? `${credential.name || credential.id} (Default)`
                  : credential.name || credential.id
              }))
            ]
          : []),
        ...(visibleAuthCredentials.length > 0 ? [{ type: 'separator' as const }] : []),
        { id: '__create_new__', label: 'Add credentials' }
      ];

  let showManagedChoiceStep = requiresManualOAuthCredentials;
  let isCreatingCredentials = !fixedCredentialId && credentialsForm.values.credentialMode === 'new';
  let isManagedSelected = !isCreatingCredentials && !!selectedVisibleCredential?.isManaged;
  let isCustomSelected = !isManagedSelected;
  let isLatestCreatedCredentialSelected =
    !!latestCreatedCredentialId &&
    credentialsForm.values.selectedCredentialId === latestCreatedCredentialId;
  let hasCredentialsStep = isOAuth && !oauthAutoRegistrationEnabled;
  let usesFlattenedOAuthCredentialsStep = hasCredentialsStep && flattenOAuthCredentialsFlow;

  let skipMethodStep = hideMethodStep || hasSingleMethod;
  let showHiddenMethodStep = hideMethodStep && showMethodStepInStepper;
  let includeMethodStep = !skipMethodStep || showHiddenMethodStep;
  let isFirstVisibleStep = step === 0 || (showHiddenMethodStep && step === 1);
  let connectStepIndex = includeMethodStep
    ? hasCredentialsStep
      ? 2
      : 1
    : hasCredentialsStep
      ? 1
      : 0;

  let selectedCredentialLabel =
    selectedVisibleCredential?.name ??
    latestCreatedCredentialLabel ??
    selectedVisibleCredential?.id ??
    fixedCredentialId ??
    (isManagedSelected ? 'Managed credentials' : 'No credentials selected');

  let openSetupWindow = (url = setupSession?.url) => {
    if (typeof window === 'undefined' || !url) return false;

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

  let clearSetupSessionForRetry = () => {
    if (setupWindowRef.current && !setupWindowRef.current.closed) {
      setupWindowRef.current.close();
    }

    setupWindowRef.current = null;
    pollingRef.current = false;
    setSetupSession(null);
    setSetupWindowBlocked(false);
  };

  let handleMethodChange = (value: string) => {
    methodForm.setFieldValue('selectedMethodId', value);
    autoStartedManagedSetupRef.current = false;
    autoCredentialModeRef.current = false;
    credentialsForm.resetForm();
    resetSetupSession();
  };

  useEffect(() => {
    if (!collectAuthConfigDetails || !onAuthConfigDetailsChange) return;

    onAuthConfigDetailsChange({
      name: authConfigDetailsForm.values.name,
      description: authConfigDetailsForm.values.description
    });
  }, [
    authConfigDetailsForm.values.description,
    authConfigDetailsForm.values.name,
    collectAuthConfigDetails,
    onAuthConfigDetailsChange
  ]);

  useEffect(() => {
    if (!onPreviewCredentialTypeChange) return;
    onPreviewCredentialTypeChange(isManagedSelected ? 'managed' : 'manual');
  }, [isManagedSelected, onPreviewCredentialTypeChange]);

  useEffect(() => {
    if (!onPreviewModeChange) return;
    if (isManagedSelected) {
      onPreviewModeChange('managed');
      return;
    }

    onPreviewModeChange(isCreatingCredentials ? 'manual_new' : 'manual_existing');
  }, [isCreatingCredentials, isManagedSelected, onPreviewModeChange]);

  useEffect(() => {
    if (!onActiveStepChange) return;

    let activeStep: 'method' | 'credentials' | 'connect';
    if (step === 0 && includeMethodStep) {
      activeStep = 'method';
    } else if (
      step === (includeMethodStep ? 1 : 0) &&
      hasCredentialsStep &&
      !usesFlattenedOAuthCredentialsStep
    ) {
      activeStep = 'credentials';
    } else {
      activeStep = 'connect';
    }

    onActiveStepChange(activeStep);
  }, [
    hasCredentialsStep,
    includeMethodStep,
    onActiveStepChange,
    step,
    usesFlattenedOAuthCredentialsStep
  ]);

  useEffect(() => {
    if (!selectedMethodId && hasSingleMethod) {
      methodForm.setFieldValue('selectedMethodId', authMethods.data!.items![0].id);
    }
  }, [authMethods.data?.items, hasSingleMethod, methodForm.setFieldValue, selectedMethodId]);

  useEffect(() => {
    if (!fixedCredentialId) return;
    if (credentialsForm.values.credentialMode !== 'existing') {
      void credentialsForm.setFieldValue('credentialMode', 'existing');
    }
    if (credentialsForm.values.selectedCredentialId !== fixedCredentialId) {
      void credentialsForm.setFieldValue('selectedCredentialId', fixedCredentialId);
    }
  }, [credentialsForm, credentialsForm.values.credentialMode, credentialsForm.values.selectedCredentialId, fixedCredentialId]);

  useEffect(() => {
    if (fixedCredentialId) return;
    if (!requiresManualOAuthCredentials) return;
    if (authCredentials.isLoading || !authCredentials.data) return;

    if (visibleAuthCredentials.length === 0) {
      if (credentialsForm.values.credentialMode !== 'new') {
        autoCredentialModeRef.current = true;
        void credentialsForm.setFieldValue('credentialMode', 'new');
      }
      if (credentialsForm.values.selectedCredentialId) {
        void credentialsForm.setFieldValue('selectedCredentialId', '');
      }
      return;
    }

    if (autoCredentialModeRef.current && credentialsForm.values.credentialMode === 'new') {
      autoCredentialModeRef.current = false;
      void credentialsForm.setFieldValue('credentialMode', 'existing');
      if (preferredVisibleCredential) {
        void credentialsForm.setFieldValue('selectedCredentialId', preferredVisibleCredential.id);
      }
      return;
    }

    if (credentialsForm.values.credentialMode === 'new') return;

    let selectedCredentialExists = visibleAuthCredentials.some(
      credential => credential.id === credentialsForm.values.selectedCredentialId
    );
    if (selectedCredentialExists || isLatestCreatedCredentialSelected) return;

    if (preferredVisibleCredential) {
      autoCredentialModeRef.current = false;
      void credentialsForm.setFieldValue('selectedCredentialId', preferredVisibleCredential.id);
      return;
    }

    if (credentialsForm.values.selectedCredentialId) {
      void credentialsForm.setFieldValue('selectedCredentialId', '');
    }
  }, [
    credentialsForm,
    authCredentials.data,
    authCredentials.isLoading,
    credentialsForm.values.credentialMode,
    credentialsForm.values.selectedCredentialId,
    fixedCredentialId,
    isLatestCreatedCredentialSelected,
    preferredVisibleCredential,
    requiresManualOAuthCredentials,
    visibleAuthCredentials
  ]);

  let handleCreateCredentials = async (): Promise<string | null> => {
    let { newCredClientId, newCredClientSecret, newCredName } = credentialsForm.values;
    if (!newCredName || !newCredClientId || !newCredClientSecret || !selectedMethod) return null;

    setError(null);

    let [result, err] = await createCredentials.mutate({
      instanceId,
      providerId,
      name: newCredName,
      config: {
        type: 'oauth',
        clientId: newCredClientId,
        clientSecret: newCredClientSecret,
        scopes: selectedMethod.scopes?.map(scope => scope.scope) ?? []
      }
    });

    if (err) {
      console.error('Failed to create credentials:', err);
      return null;
    }
    if (!result) return null;

    setLatestCreatedCredentialId(result.id);
    setLatestCreatedCredentialLabel(result.name ?? newCredName);
    await credentialsForm.setFieldValue('credentialMode', 'existing');
    await credentialsForm.setFieldValue('selectedCredentialId', result.id);
    await credentialsForm.setFieldValue('newCredName', '');
    await credentialsForm.setFieldValue('newCredClientId', '');
    await credentialsForm.setFieldValue('newCredClientSecret', '');

    return result.id;
  };

  let handleCredentialSelectionChange = (value: string) => {
    if (fixedCredentialId) return;
    setError(null);
    setLatestCreatedCredentialId(null);
    setLatestCreatedCredentialLabel(null);
    autoStartedManagedSetupRef.current = false;
    autoCredentialModeRef.current = false;

    if (value === '__create_new__') {
      void credentialsForm.setFieldValue('credentialMode', 'new');
      void credentialsForm.setFieldValue('selectedCredentialId', '');
      return;
    }

    void credentialsForm.setFieldValue('credentialMode', 'existing');
    void credentialsForm.setFieldValue('selectedCredentialId', value);
  };

  useEffect(() => {
    onWindowOpenStateChange?.(!!setupSession?.url);
  }, [onWindowOpenStateChange, setupSession?.url]);

  let resolveSelectedCredentialId = async () => {
    if (fixedCredentialId) return fixedCredentialId;

    let providerAuthCredentialsId = effectiveSelectedCredentialId;

    if (credentialsForm.values.credentialMode === 'new') {
      providerAuthCredentialsId = (await handleCreateCredentials()) ?? '';
      if (!providerAuthCredentialsId) return null;
    }

    if (
      providerAuthCredentialsId &&
      providerAuthCredentialsId !== credentialsForm.values.selectedCredentialId
    ) {
      await credentialsForm.setFieldValue('selectedCredentialId', providerAuthCredentialsId);
    }

    return providerAuthCredentialsId || null;
  };

  let handleStartSetup = async (providerAuthCredentialsId?: string) => {
    if (!selectedMethodId) return null;

    if (collectAuthConfigDetails) {
      authConfigDetailsForm.setFieldTouched('name', true, false);
      await authConfigDetailsForm.validateField('name');
      if (!authConfigDetailsForm.values.name.trim()) return null;
    }

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
      name: collectAuthConfigDetails ? authConfigDetailsForm.values.name.trim() : undefined,
      description:
        collectAuthConfigDetails && authConfigDetailsForm.values.description
          ? authConfigDetailsForm.values.description
          : undefined,
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

      let [result, err] = await getSetupSessionRef.current.mutate({
        setupSessionId: setupSession.id
      });

      if (err) {
        console.warn('Failed to poll setup session:', err);
      } else {
        if (result) setSetupSession(result);

        if (result?.status === 'completed') {
          completedRef.current = true;
          if (setupWindowRef.current && !setupWindowRef.current.closed) {
            setupWindowRef.current.close();
            setupWindowRef.current = null;
          }
          onCompleteRef.current(result);
          return;
        }

        if (result?.status === 'failed' || result?.status === 'expired') {
          setError(
            result.status === 'expired'
              ? 'Setup session expired. Please start again.'
              : 'Setup session failed. Please try again.'
          );
          clearSetupSessionForRetry();
          return;
        }
      }

      attempts += 1;
      if (attempts > 120) {
        setError('Authentication timed out. Please try again.');
        clearSetupSessionForRetry();
        return;
      }

      setTimeout(poll, 2000);
    };

    poll();

    return () => {
      canceled = true;
    };
  }, [setupSession?.id]);

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
    isOAuth,
    isStarting,
    oauthAutoRegistrationEnabled,
    selectedMethodId,
    setupSession,
    skipMethodStep
  ]);

  useEffect(() => {
    if (
      !autoStartManagedCredentialSetup ||
      !requiresManualOAuthCredentials ||
      !usesFlattenedOAuthCredentialsStep ||
      !isManagedSelected ||
      !effectiveSelectedCredentialId ||
      !!setupSession ||
      isStarting ||
      autoStartedManagedSetupRef.current
    ) {
      return;
    }

    if (collectAuthConfigDetails && !authConfigDetailsForm.values.name.trim()) {
      return;
    }

    autoStartedManagedSetupRef.current = true;
    void handleStartSetup(effectiveSelectedCredentialId);
  }, [
    authConfigDetailsForm.values.name,
    autoStartManagedCredentialSetup,
    collectAuthConfigDetails,
    effectiveSelectedCredentialId,
    isManagedSelected,
    isStarting,
    requiresManualOAuthCredentials,
    setupSession,
    usesFlattenedOAuthCredentialsStep
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
      <SetupStateMessage
        message={deployment.error.message ?? 'Failed to load deployment.'}
        messageColor="red500"
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        onClose={() => onComplete(null)}
      />
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
      <SetupStateMessage
        message={provider.error.message ?? 'Failed to load provider details.'}
        messageColor="red500"
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        onClose={() => onComplete(null)}
      />
    );
  }

  if (!effectiveVersionId) {
    return (
      <SetupStateMessage
        message="No provider version is available yet, so authentication cannot be configured."
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        onClose={() => onComplete(null)}
      />
    );
  }

  if (authMethods.error) {
    return (
      <SetupStateMessage
        message={authMethods.error.message ?? 'Failed to load authentication methods.'}
        messageColor="red500"
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        onClose={() => onComplete(null)}
      />
    );
  }

  if (authCredentials.error) {
    return (
      <SetupStateMessage
        message={authCredentials.error?.message ?? 'Failed to load authentication credentials.'}
        messageColor="red500"
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        onClose={() => onComplete(null)}
      />
    );
  }

  if (!authMethods.data?.items?.length) {
    return (
      <SetupStateMessage
        message="This provider does not require authentication."
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        onClose={() => onComplete(null)}
      />
    );
  }

  if (setupSession && !setupSession.url) {
    return (
      <MissingSetupWindowState
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        onChangeMethod={() => {
          setSetupSession(null);
          pollingRef.current = false;
        }}
      />
    );
  }

  let handleConnectBack = () => {
    if (step > 0) {
      setStep(prev => prev - 1);
      return;
    }

    onBackToMethodSelection?.();
  };

  let methodStep = MethodSelectionStep({
    methodForm,
    authMethods,
    lockedVersionId,
    selectedMethodId,
    onMethodChange: handleMethodChange,
    onCancel,
    cancelLabel
  });

  let credentialsStep = CredentialsSelectionStep({
    credentialsForm,
    selectedCredentialId: effectiveSelectedCredentialId,
    hasSelectedCredential: !!effectiveSelectedCredentialId,
    hideCredentialsIntro,
    oauthMethodName,
    showManagedChoiceStep,
    showExternalPreviewSidebar,
    credentialSelectItems,
    handleCredentialSelectionChange,
    hasManagedVisibleCredentials,
    redirectUri: redirectUri ?? undefined,
    isCustomSelected,
    isCreatingCredentials,
    disableCredentialSelection: !!fixedCredentialId,
    projectBrandImageUrl,
    projectBrandName,
    providerName,
    providerImageUrl,
    isManagedSelected,
    error,
    createCredentials,
    providerDoc: oauthDoc,
    configDoc: oauthDoc,
    showHiddenMethodStep,
    includeMethodStep,
    skipMethodStep,
    onBackToMethodSelection,
    onBack: () => setStep(0)
  });

  let flatOauthCredentialsStep = FlatOAuthConnectStep({
    collectAuthConfigDetails,
    authConfigDetailsForm,
    selectedCredentialId: effectiveSelectedCredentialId,
    hasSelectedCredential: !!effectiveSelectedCredentialId,
    redirectUri: redirectUri ?? undefined,
    isCustomSelected,
    credentialsForm,
    isCreatingCredentials,
    disableCredentialSelection: !!fixedCredentialId,
    credentialSelectItems,
    handleCredentialSelectionChange,
    hasManagedVisibleCredentials,
    createCredentials,
    createSetupSession,
    providerDoc: oauthDoc,
    configDoc: oauthDoc,
    error,
    setupSession,
    setupWindowBlocked,
    onCancel,
    cancelLabel,
    onWindowOpenCancel,
    windowOpenCancelLabel,
    isStarting,
    resolveSelectedCredentialId,
    handleStartSetup,
    openSetupWindow: () => {
      let opened = openSetupWindow();
      setSetupWindowBlocked(!opened);
      return opened;
    }
  });

  let connectStep = ConnectStep({
    connectSubtitle: isOAuth ? 'Complete authentication' : 'Start setup',
    setupSession,
    setupWindowBlocked,
    selectedCredentialLabel,
    hasCredentialsStep,
    isManagedSelected,
    isSelectedCredentialDefault: !!selectedVisibleCredential?.isDefault,
    collectAuthConfigDetails,
    authConfigDetailsForm,
    oauthMethodName,
    onWindowOpenCancel,
    onCancel,
    windowOpenCancelLabel,
    cancelLabel,
    openSetupWindow: () => {
      let opened = openSetupWindow();
      setSetupWindowBlocked(!opened);
      return opened;
    },
    skipMethodStep,
    onBackToMethodSelection,
    resetSetupSession,
    onBack: handleConnectBack,
    error,
    isOAuth: !!isOAuth,
    providerName,
    createSetupSession,
    handleStartSetup: () =>
      handleStartSetup(effectiveSelectedCredentialId || undefined),
    isStarting,
    selectedMethodId,
    isFirstVisibleStep
  });

  let steps: SetupStep[] = (() => {
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

      if (usesFlattenedOAuthCredentialsStep) {
        return includeMethodStep ? [methodStep, flatOauthCredentialsStep] : [flatOauthCredentialsStep];
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
