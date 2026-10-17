import { useForm } from '@metorial/data-hooks';
import { Stepper } from '@metorial/explainer';
import {
  useCreateProviderAuthCredentials,
  useCurrentProject,
  useProjectBrand,
  useProvider,
  useProviderAuthCredentials,
  useProviderAuthMethods,
  useProviderDeployment,
  useProviderListing
} from '@metorial/state';
import { Text } from '@metorial/ui';
import { sortBy } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAuthMethodOAuthDoc } from '../../../lib/providerDocs';
import { getProviderOAuthAutoRegistrationEnabled } from '../../../lib/providerOAuthAutoRegistration';
import { useProviderSetupSessionRunner } from '../setupSessionRunner';
import {
  ConnectStep,
  CredentialsSelectionStep,
  MethodSelectionStep,
  MissingSetupWindowState,
  SetupStateMessage,
  type SetupStep
} from './stepContent';
import type { CredentialsMode, ProviderSetupSessionEmbedProps } from './types';

export let ProviderSetupSessionEmbed = ({
  instanceId,
  providerId,
  deploymentId,
  onComplete,
  onCancel,
  cancelLabel = 'Cancel'
}: ProviderSetupSessionEmbedProps) => {
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let lockedVersionId = deployment.data?.lockedVersion?.id;
  let provider = useProvider(instanceId, providerId);
  let providerListing = useProviderListing(instanceId, providerId);
  let project = useCurrentProject();
  let projectBrand = useProjectBrand(project.data?.organization.id, project.data?.id);
  let effectiveVersionId = lockedVersionId ?? provider.data?.currentVersion?.id;

  let [step, setStep] = useState(0);
  let [latestCreatedCredentialId, setLatestCreatedCredentialId] = useState<string | null>(null);
  let [latestCreatedCredentialLabel, setLatestCreatedCredentialLabel] = useState<string | null>(
    null
  );
  let autoStartedRef = useRef(false);
  let autoCredentialModeRef = useRef(false);

  let runner = useProviderSetupSessionRunner({
    instanceId,
    providerId,
    providerDeploymentId: deploymentId,
    onComplete
  });

  let methodForm = useForm({
    initialValues: {
      selectedMethodId: ''
    },
    onSubmit: async values => {
      if (!values.selectedMethodId) return;
      setStep(1);
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

  let credentialsForm = useForm({
    initialValues: {
      credentialMode: 'existing' as CredentialsMode,
      selectedCredentialId: '',
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
  let hasManagedVisibleCredentials = managedVisibleCredentials.length > 0;
  let requiresManualOAuthCredentials = isOAuth && !oauthAutoRegistrationEnabled;
  let preferredVisibleCredential =
    managedVisibleCredentials.find(credential => credential.isDefault) ??
    managedVisibleCredentials[0] ??
    customVisibleCredentials.find(credential => credential.isDefault) ??
    customVisibleCredentials[0] ??
    null;
  let effectiveSelectedCredentialId =
    credentialsForm.values.credentialMode === 'new'
      ? ''
      : credentialsForm.values.selectedCredentialId || preferredVisibleCredential?.id || '';
  let selectedVisibleCredential = visibleAuthCredentials.find(
    credential => credential.id === effectiveSelectedCredentialId
  );
  let credentialSelectItems = [
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

  let isCreatingCredentials = credentialsForm.values.credentialMode === 'new';
  let isManagedSelected = !isCreatingCredentials && !!selectedVisibleCredential?.isManaged;
  let isLatestCreatedCredentialSelected =
    !!latestCreatedCredentialId &&
    credentialsForm.values.selectedCredentialId === latestCreatedCredentialId;
  let hasCredentialsStep = requiresManualOAuthCredentials;
  let includeMethodStep = !hasSingleMethod;
  let connectStepIndex = (includeMethodStep ? 1 : 0) + (hasCredentialsStep ? 1 : 0);
  let isFirstVisibleStep = step === 0;

  let selectedCredentialLabel =
    selectedVisibleCredential?.name ??
    latestCreatedCredentialLabel ??
    selectedVisibleCredential?.id ??
    (isManagedSelected ? 'Managed credentials' : 'No credentials selected');

  let handleMethodChange = (value: string) => {
    methodForm.setFieldValue('selectedMethodId', value);
    autoCredentialModeRef.current = false;
    autoStartedRef.current = false;
    credentialsForm.resetForm();
    runner.reset();
  };

  useEffect(() => {
    if (!selectedMethodId && hasSingleMethod) {
      methodForm.setFieldValue('selectedMethodId', authMethods.data!.items![0].id);
    }
  }, [authMethods.data?.items, hasSingleMethod, methodForm.setFieldValue, selectedMethodId]);

  useEffect(() => {
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
    isLatestCreatedCredentialSelected,
    preferredVisibleCredential,
    requiresManualOAuthCredentials,
    visibleAuthCredentials
  ]);

  let handleCreateCredentials = async (): Promise<string | null> => {
    let { newCredClientId, newCredClientSecret, newCredName } = credentialsForm.values;
    if (!newCredName || !newCredClientId || !newCredClientSecret || !selectedMethod) return null;

    runner.setError(null);

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
    runner.setError(null);
    setLatestCreatedCredentialId(null);
    setLatestCreatedCredentialLabel(null);
    autoCredentialModeRef.current = false;

    if (value === '__create_new__') {
      void credentialsForm.setFieldValue('credentialMode', 'new');
      void credentialsForm.setFieldValue('selectedCredentialId', '');
      return;
    }

    void credentialsForm.setFieldValue('credentialMode', 'existing');
    void credentialsForm.setFieldValue('selectedCredentialId', value);
  };

  let resolveSelectedCredentialId = async () => {
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

  let handleStartSetup = (providerAuthCredentialsId?: string) => {
    if (!selectedMethodId) return Promise.resolve(null);

    return runner.start({
      providerAuthMethodId: selectedMethodId,
      providerAuthCredentialsId,
      openWindow: isOAuth
    });
  };

  useEffect(() => {
    if (
      !runner.setupSession &&
      !runner.isStarting &&
      !autoStartedRef.current &&
      selectedMethodId &&
      isOAuth &&
      oauthAutoRegistrationEnabled &&
      !includeMethodStep
    ) {
      autoStartedRef.current = true;
      void handleStartSetup();
    }
  }, [
    includeMethodStep,
    isOAuth,
    runner.isStarting,
    oauthAutoRegistrationEnabled,
    selectedMethodId,
    runner.setupSession
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

  let renderStateMessage = (message: string, isError = false) => (
    <SetupStateMessage
      message={message}
      messageColor={isError ? 'red500' : undefined}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      onClose={() => onComplete(null)}
    />
  );

  if (deploymentId && deployment.error) {
    return renderStateMessage(deployment.error.message ?? 'Failed to load deployment.', true);
  }

  if (deploymentId && !deployment.data) {
    return (
      <Text size="2" color="gray600">
        Loading deployment details...
      </Text>
    );
  }

  if (!lockedVersionId && provider.error) {
    return renderStateMessage(provider.error.message ?? 'Failed to load provider details.', true);
  }

  if (!effectiveVersionId) {
    return renderStateMessage(
      'No provider version is available yet, so authentication cannot be configured.'
    );
  }

  if (authMethods.error) {
    return renderStateMessage(
      authMethods.error.message ?? 'Failed to load authentication methods.',
      true
    );
  }

  if (authCredentials.error) {
    return renderStateMessage(
      authCredentials.error.message ?? 'Failed to load authentication credentials.',
      true
    );
  }

  if (!authMethods.data?.items?.length) {
    return renderStateMessage('This provider does not require authentication.');
  }

  if (runner.setupSession && !runner.setupSession.url) {
    return (
      <MissingSetupWindowState
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        onChangeMethod={runner.reset}
      />
    );
  }

  let openSetupWindow = () => runner.openWindow();

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
    oauthMethodName,
    credentialSelectItems,
    handleCredentialSelectionChange,
    hasManagedVisibleCredentials,
    redirectUri: redirectUri ?? undefined,
    isCustomSelected: !isManagedSelected,
    isCreatingCredentials,
    projectBrandImageUrl,
    projectBrandName,
    providerName,
    providerImageUrl,
    isManagedSelected,
    error: runner.error,
    createCredentials,
    providerDoc: oauthDoc,
    configDoc: oauthDoc,
    includeMethodStep,
    onBack: () => setStep(0)
  });

  let connectStep = ConnectStep({
    connectSubtitle: isOAuth ? 'Complete authentication' : 'Start setup',
    setupSession: runner.setupSession,
    setupWindowBlocked: runner.windowBlocked,
    selectedCredentialLabel,
    hasCredentialsStep,
    isManagedSelected,
    isSelectedCredentialDefault: !!selectedVisibleCredential?.isDefault,
    oauthMethodName,
    onCancel,
    cancelLabel,
    openSetupWindow,
    showChangeMethod: includeMethodStep,
    resetSetupSession: runner.reset,
    onBack: () => setStep(prev => Math.max(0, prev - 1)),
    error: runner.error,
    isOAuth: !!isOAuth,
    providerName,
    handleStartSetup: () => handleStartSetup(effectiveSelectedCredentialId || undefined),
    isStarting: runner.isStarting,
    selectedMethodId,
    isFirstVisibleStep
  });

  let steps: SetupStep[] = (() => {
    if (isOAuth && hasCredentialsStep) {
      return includeMethodStep
        ? [methodStep, credentialsStep, connectStep]
        : [credentialsStep, connectStep];
    }

    let subtitle = isOAuth ? 'Complete authentication' : 'Start setup';
    return includeMethodStep
      ? [methodStep, { ...connectStep, subtitle }]
      : [{ ...connectStep, subtitle }];
  })();

  if (steps.length <= 1) {
    return <>{steps[0]?.render()}</>;
  }

  return <Stepper steps={steps} currentStep={step} setCurrentStep={setStep} />;
};
