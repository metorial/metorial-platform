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
  type DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput,
  type DashboardInstanceProviderDeploymentsSetupSessionsGetOutput,
  type DashboardInstanceProvidersAuthMethodsListOutput
} from '@metorial/state';
import {
  Avatar,
  Badge,
  Button,
  Copy,
  Flex,
  Input,
  Select,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { sortBy } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Stepper } from '../../../../components/stepper';
import { getProviderOAuthAutoRegistrationEnabled } from '../../lib/providerOAuthAutoRegistration';
import { AuthMethodPicker } from '../providerAuthConfigs/authMethodPicker';

type AuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];
type CredentialsMode = 'existing' | 'new';
type SetupSessionState =
  | DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput
  | DashboardInstanceProviderDeploymentsSetupSessionsGetOutput;

let ManagedCredentialsLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
`;

let ManagedCredentialsColumn = styled.div`
  display: flex;
  flex-direction: column;
`;

let ManagedCredentialsPreview = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-left: 20px;
  border-left: 1px solid ${theme.colors.gray300};
  align-self: stretch;

  @media (max-width: 800px) {
    padding-left: 0;
    padding-top: 16px;
    border-left: none;
    border-top: 1px solid ${theme.colors.gray300};
  }
`;

let ManagedCredentialsPreviewFrame = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid ${theme.colors.gray300};
  min-height: 100%;
`;

let ManagedCredentialsPreviewHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

let ManagedCredentialsMetaRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

let SummaryField = styled.div`
  display: flex;
  flex-direction: column;
`;

let SummaryFieldValue = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid ${theme.colors.gray300};
`;

let SummaryFieldMeta = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

let ManagedCredentialsPreviewBrand = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid ${theme.colors.gray300};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
`;

let ManagedCredentialsPreviewBrandImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

let ManagedCredentialsPreviewConnection = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 0;
`;

let ManagedCredentialsPreviewConnector = styled.div`
  flex: 1;
  height: 1px;
  background: ${theme.colors.gray300};
`;

let ManagedCredentialsPreviewAction = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  background: ${theme.colors.gray900};
  color: ${theme.colors.background};
  font-size: 14px;
  font-weight: 600;
`;

let ManagedCredentialsPreviewTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let ManagedCredentialsPreviewCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 12px;
  border: 1px dashed ${theme.colors.gray400};
  background: ${theme.colors.background};
`;

let FlatConnectForm = styled.div`
  display: flex;
  flex-direction: column;
`;

let FlatConnectSection = styled.section`
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 14px;
  margin-top: 15px;
  border: 1px solid ${theme.colors.gray300};
`;

let FlatInlineField = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 15px;
`;

export let ProviderSetupSessionEmbed = ({
  instanceId,
  providerId,
  deploymentId,
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
  onAuthConfigDetailsChange,
  onPreviewCredentialTypeChange,
  onPreviewModeChange,
  onActiveStepChange
}: {
  instanceId: string;
  providerId: string;
  deploymentId?: string;
  onComplete: (
    setupSession: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput | null
  ) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  onWindowOpenCancel?: () => void;
  windowOpenCancelLabel?: string;
  onWindowOpenStateChange?: (isOpen: boolean) => void;
  initialMethodId?: string;
  hideMethodStep?: boolean;
  onBackToMethodSelection?: () => void;
  showMethodStepInStepper?: boolean;
  hideCredentialsIntro?: boolean;
  flattenOAuthCredentialsFlow?: boolean;
  showExternalPreviewSidebar?: boolean;
  collectAuthConfigDetails?: boolean;
  onAuthConfigDetailsChange?: (details: { name: string; description: string }) => void;
  onPreviewCredentialTypeChange?: (type: 'managed' | 'manual') => void;
  onPreviewModeChange?: (mode: 'managed' | 'manual_existing' | 'manual_new') => void;
  onActiveStepChange?: (step: 'method' | 'credentials' | 'connect') => void;
}) => {
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let lockedVersionId = deployment.data?.lockedVersion?.id;
  let provider = useProvider(instanceId, providerId);
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
      selectedCredentialId: '',
      newCredName: '',
      newCredClientId: '',
      newCredClientSecret: ''
    },
    onSubmit: async values => {
      let providerAuthCredentialsId = await resolveSelectedCredentialId(values);
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

  let [isStarting, setIsStarting] = useState(false);
  let [error, setError] = useState<string | null>(null);
  let [setupSession, setSetupSession] = useState<SetupSessionState | null>(null);
  let [step, setStep] = useState(hideMethodStep && showMethodStepInStepper ? 1 : 0);
  let [setupWindowBlocked, setSetupWindowBlocked] = useState(false);
  let [latestCreatedCredentialId, setLatestCreatedCredentialId] = useState<string | null>(
    null
  );
  let [latestCreatedCredentialLabel, setLatestCreatedCredentialLabel] = useState<
    string | null
  >(null);
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
  let projectBrandImageUrl = projectBrand.data?.imageUrl;
  let projectBrandName = projectBrand.data?.name ?? project.data?.name ?? 'Metorial';
  let providerImageUrl = provider.data?.publisher.imageUrl;
  let visibleAuthCredentials = sortBy(authCredentials.data?.items ?? [], [
    credential => Number(!credential.isManaged),
    credential => Number(!credential.isDefault),
    credential => credential.name ?? credential.id
  ]);
  let managedVisibleCredentials = visibleAuthCredentials.filter(
    credential => credential.isManaged
  );
  let customVisibleCredentials = visibleAuthCredentials.filter(
    credential => !credential.isManaged
  );
  let hasManagedVisibleCredentials = visibleAuthCredentials.some(
    credential => credential.isManaged
  );
  let requiresManualOAuthCredentials = isOAuth && !oauthAutoRegistrationEnabled;
  let preferredVisibleCredential =
    managedVisibleCredentials.find(credential => credential.isDefault) ??
    managedVisibleCredentials[0] ??
    customVisibleCredentials.find(credential => credential.isDefault) ??
    customVisibleCredentials[0] ??
    (visibleAuthCredentials.length === 1 ? visibleAuthCredentials[0] : null);
  let selectedVisibleCredential = visibleAuthCredentials.find(
    credential => credential.id === credentialsForm.values.selectedCredentialId
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
  let showManagedChoiceStep = requiresManualOAuthCredentials;
  let isCreatingCredentials = credentialsForm.values.credentialMode === 'new';
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
  let authConfigDetailsForm = useForm({
    initialValues: {
      name: '',
      description: ''
    },
    updateInitialValues: true,
    onSubmit: async () => undefined,
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure()
      })
  });

  useEffect(() => {
    if (!collectAuthConfigDetails || !onAuthConfigDetailsChange) return;

    onAuthConfigDetailsChange({
      name: authConfigDetailsForm.values.name,
      description: authConfigDetailsForm.values.description
    });
  }, [
    collectAuthConfigDetails,
    onAuthConfigDetailsChange,
    authConfigDetailsForm.values.name,
    authConfigDetailsForm.values.description
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
    if (isLatestCreatedCredentialSelected) return;
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
    isLatestCreatedCredentialSelected,
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
    setError(null);
    setLatestCreatedCredentialId(null);
    setLatestCreatedCredentialLabel(null);

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

  let resolveSelectedCredentialId = async (values: typeof credentialsForm.values) => {
    let providerAuthCredentialsId = values.selectedCredentialId;

    if (values.credentialMode === 'new') {
      providerAuthCredentialsId = (await handleCreateCredentials(values)) ?? '';
      if (!providerAuthCredentialsId) return null;
    }

    if (
      providerAuthCredentialsId &&
      providerAuthCredentialsId !== values.selectedCredentialId
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

  let renderConnectSummary = (p: { disabled?: boolean }) => {
    let selectedCredentialLabel =
      selectedVisibleCredential?.name ??
      latestCreatedCredentialLabel ??
      selectedVisibleCredential?.id ??
      (isManagedSelected ? 'Managed credentials' : 'No credentials selected');

    return (
      <>
        {hasCredentialsStep && (
          <>
            <SummaryField>
              <Text size="1" color="black900" style={{ marginBottom: 6 }}>
                Credentials
              </Text>
              <SummaryFieldValue>
                <div style={{ minWidth: 0 }}>
                  <Text size="2" weight="medium">
                    {selectedCredentialLabel}
                  </Text>
                </div>

                <SummaryFieldMeta>
                  {isManagedSelected && <Badge color="gray">Managed</Badge>}
                  {selectedVisibleCredential?.isDefault && <Badge color="blue">Default</Badge>}
                </SummaryFieldMeta>
              </SummaryFieldValue>
            </SummaryField>

            <Spacer size={20} />
          </>
        )}

        {renderAuthConfigDetailsFields(p)}
      </>
    );
  };

  let renderAuthConfigDetailsFields = (p: { disabled?: boolean }) =>
    collectAuthConfigDetails ? (
      <>
        <Input
          label="Auth Config Name"
          description="Name the connection so you can tell it apart from other auth configs."
          {...authConfigDetailsForm.getFieldProps('name')}
          placeholder="e.g. John Doe"
          disabled={p.disabled}
        />
        <authConfigDetailsForm.RenderError field="name" />

        <Spacer size={10} />

        <Input
          label="Auth Config Description"
          description="Optional context for your team about what this connection is used for."
          placeholder="e.g. Production workspace for the CRM sync"
          {...authConfigDetailsForm.getFieldProps('description')}
          disabled={p.disabled}
        />
        <authConfigDetailsForm.RenderError field="description" />
      </>
    ) : null;

  let steps = (() => {
    let methodStep = {
      title: 'Authentication',
      subtitle: 'Select auth method',
      render: () => (
        <form onSubmit={methodForm.handleSubmit}>
          {!lockedVersionId && (
            <>
              <Text size="1" color="gray600">
                This deployment is not pinned. Authentication methods are being loaded from the
                provider&apos;s current version.
              </Text>
              <Spacer size={6} />
            </>
          )}

          <AuthMethodPicker
            label="Authentication Method"
            hideLabel
            focusOnMount
            value={selectedMethodId}
            onChange={value => {
              methodForm.setFieldValue('selectedMethodId', value);
              credentialsForm.resetForm();
              resetSetupSession();
            }}
            items={(authMethods.data?.items ?? []).map(method => ({
              id: method.id,
              name: method.name,
              description: method.description
            }))}
          />

          <methodForm.RenderError field="selectedMethodId" />

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
          {!hideCredentialsIntro && (
            <>
              <Text size="2" weight="strong">
                Select {oauthMethodName} Credentials
              </Text>
              <Text size="2" color="gray600">
                Select existing credentials or add new credentials to continue.
              </Text>
              <Spacer size={6} />
            </>
          )}

          {showManagedChoiceStep ? (
            <>
              <ManagedCredentialsLayout
                style={showExternalPreviewSidebar ? { gridTemplateColumns: '1fr' } : undefined}
              >
                <ManagedCredentialsColumn>
                  <Select
                    label="Credentials"
                    description="Select existing credentials or add new ones for this provider."
                    value={
                      credentialsForm.values.credentialMode === 'new'
                        ? '__create_new__'
                        : credentialsForm.values.selectedCredentialId
                    }
                    placeholder="Select or add credentials"
                    onChange={handleCredentialSelectionChange}
                    items={credentialSelectItems}
                  />
                  <credentialsForm.RenderError field="selectedCredentialId" />

                  {hasManagedVisibleCredentials && (
                    <>
                      <Spacer size={5} />
                      <Text size="1" color="gray600">
                        Metorial Managed credentials are available for quick testing, or choose
                        Add credentials to use your own OAuth app.
                      </Text>
                    </>
                  )}

                  {redirectUri && isCustomSelected && (
                    <>
                      <Spacer size={12} />
                      <Text size="1" weight="medium" color="gray900">
                        Redirect URI
                      </Text>
                      <Text size="1" color="gray600" style={{ marginBottom: 5 }}>
                        You must configure this redirect URI in your OAuth app.{' '}
                        {/*
                        <RedirectUriDocsLink
                          href="https://metorial.com/docs"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Read the docs to learn more
                        </RedirectUriDocsLink>
                        .
                        */}
                      </Text>
                      <Copy value={redirectUri} />
                    </>
                  )}

                  {isCreatingCredentials && (
                    <>
                      <Spacer size={12} />

                      <Input
                        label="Name"
                        value={credentialsForm.values.newCredName}
                        onChange={e =>
                          credentialsForm.setFieldValue('newCredName', e.target.value)
                        }
                        placeholder="My OAuth App"
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
                      />
                      <credentialsForm.RenderError field="newCredClientSecret" />
                    </>
                  )}
                </ManagedCredentialsColumn>

                {!showExternalPreviewSidebar && (
                  <ManagedCredentialsPreview>
                    <ManagedCredentialsPreviewFrame>
                      <ManagedCredentialsPreviewTop>
                        <Text size="2" weight="strong">
                          Preview
                        </Text>
                        <Text size="1" color="gray600">
                          OAuth connection preview
                        </Text>
                      </ManagedCredentialsPreviewTop>

                      <ManagedCredentialsPreviewCard>
                        <ManagedCredentialsPreviewHeader>
                          <ManagedCredentialsPreviewBrand>
                            {projectBrandImageUrl ? (
                              <ManagedCredentialsPreviewBrandImage
                                src={projectBrandImageUrl}
                                alt={projectBrandName}
                              />
                            ) : (
                              <Avatar
                                entity={{ name: projectBrandName }}
                                size={28}
                                radius={8}
                                noTooltip
                              />
                            )}
                          </ManagedCredentialsPreviewBrand>

                          <div style={{ minWidth: 0 }}>
                            <Text size="2" weight="strong">
                              {projectBrandName}
                            </Text>
                            <Text size="1" color="gray600">
                              Continue with {providerName}
                            </Text>
                          </div>
                        </ManagedCredentialsPreviewHeader>

                        <ManagedCredentialsPreviewConnection>
                          <Avatar
                            entity={{
                              name: projectBrandName,
                              imageUrl: projectBrandImageUrl
                            }}
                            size={44}
                            radius={10}
                            noTooltip
                            imageFit="contain"
                          />
                          <ManagedCredentialsPreviewConnector />
                          <Avatar
                            entity={{
                              name: providerName,
                              imageUrl: providerImageUrl
                            }}
                            size={44}
                            radius={10}
                            noTooltip
                            imageFit="contain"
                          />
                        </ManagedCredentialsPreviewConnection>

                        <ManagedCredentialsPreviewAction>
                          Connect {providerName}
                        </ManagedCredentialsPreviewAction>
                      </ManagedCredentialsPreviewCard>

                      <ManagedCredentialsMetaRow>
                        {isManagedSelected ? (
                          <>
                            <Badge color="gray">Managed</Badge>
                            <Badge color="gray">Read-only</Badge>
                          </>
                        ) : hasManagedVisibleCredentials ? (
                          <Badge color="blue">Custom</Badge>
                        ) : (
                          <Badge color="blue">Your credentials</Badge>
                        )}
                      </ManagedCredentialsMetaRow>
                    </ManagedCredentialsPreviewFrame>
                  </ManagedCredentialsPreview>
                )}
              </ManagedCredentialsLayout>
            </>
          ) : (
            <>
              <Select
                label="Credentials"
                description="Select existing credentials or add new ones for this provider."
                value={
                  credentialsForm.values.credentialMode === 'new'
                    ? '__create_new__'
                    : credentialsForm.values.selectedCredentialId
                }
                placeholder="Select or add credentials"
                onChange={handleCredentialSelectionChange}
                items={credentialSelectItems}
              />
              <credentialsForm.RenderError field="selectedCredentialId" />

              {hasManagedVisibleCredentials && (
                <>
                  <Spacer size={5} />
                  <Text size="1" color="gray600">
                    Metorial Managed credentials are available for quick testing, or choose Add
                    credentials to use your own OAuth app.
                  </Text>
                </>
              )}

              {isCreatingCredentials && (
                <>
                  <Spacer size={12} />

                  <Input
                    label="Name"
                    value={credentialsForm.values.newCredName}
                    onChange={e =>
                      credentialsForm.setFieldValue('newCredName', e.target.value)
                    }
                    placeholder="My OAuth App"
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
                  />
                  <credentialsForm.RenderError field="newCredClientSecret" />
                </>
              )}
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
            {!showHiddenMethodStep && includeMethodStep && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
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
              loading={createCredentials.isPending}
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

    let flatOauthCredentialsStep = {
      title: 'Connect',
      subtitle: 'Complete authentication',
      render: () => {
        let isWindowOpen = !!setupSession?.url;

        return (
          <form
            onSubmit={async e => {
              e.preventDefault();

              if (isWindowOpen) return;

              if (
                isCustomSelected &&
                !credentialsForm.values.selectedCredentialId &&
                !isCreatingCredentials
              ) {
                credentialsForm.setFieldTouched('selectedCredentialId', true, false);
                await credentialsForm.validateField('selectedCredentialId');
                return;
              }

              let providerAuthCredentialsId = await resolveSelectedCredentialId(
                credentialsForm.values
              );

              if (isCustomSelected && !providerAuthCredentialsId) {
                return;
              }

              await handleStartSetup(providerAuthCredentialsId ?? undefined);
            }}
          >
            <FlatConnectForm>
              {collectAuthConfigDetails &&
                renderAuthConfigDetailsFields({ disabled: isWindowOpen })}

              {redirectUri && isCustomSelected && (
                <FlatInlineField>
                  <Text size="1" weight="medium" color="gray900" style={{ margin: 0 }}>
                    Redirect URI
                  </Text>
                  <Text size="1" color="gray600" style={{ margin: 0 }}>
                    You must configure this redirect URI in your OAuth app.
                  </Text>
                  <Spacer size={10} />
                  <Copy value={redirectUri} />
                </FlatInlineField>
              )}

              <FlatConnectSection>
                <Select
                  label="Credentials"
                  description="Select existing credentials or add new ones for this provider."
                  value={
                    credentialsForm.values.credentialMode === 'new'
                      ? '__create_new__'
                      : credentialsForm.values.selectedCredentialId
                  }
                  placeholder="Select or add credentials"
                  disabled={isWindowOpen}
                  onChange={handleCredentialSelectionChange}
                  items={credentialSelectItems}
                />
                <credentialsForm.RenderError field="selectedCredentialId" />

                {hasManagedVisibleCredentials && (
                  <>
                    <Spacer size={5} />
                    <Text size="1" color="gray600">
                      Metorial Managed credentials are available for quick testing, or choose
                      Add credentials to use your own OAuth app.
                    </Text>
                  </>
                )}

                {isCreatingCredentials && (
                  <>
                    <Spacer size={8} />

                    <Input
                      label="Name"
                      value={credentialsForm.values.newCredName}
                      disabled={isWindowOpen}
                      onChange={e =>
                        credentialsForm.setFieldValue('newCredName', e.target.value)
                      }
                      placeholder="My OAuth App"
                    />
                    <credentialsForm.RenderError field="newCredName" />

                    <Spacer size={8} />

                    <Input
                      label="Client ID"
                      value={credentialsForm.values.newCredClientId}
                      disabled={isWindowOpen}
                      onChange={e =>
                        credentialsForm.setFieldValue('newCredClientId', e.target.value)
                      }
                      placeholder="Enter client ID from provider"
                    />
                    <credentialsForm.RenderError field="newCredClientId" />

                    <Spacer size={8} />

                    <Input
                      label="Client Secret"
                      value={credentialsForm.values.newCredClientSecret}
                      disabled={isWindowOpen}
                      onChange={e =>
                        credentialsForm.setFieldValue('newCredClientSecret', e.target.value)
                      }
                      placeholder="Enter client secret from provider"
                      type="password"
                    />
                    <credentialsForm.RenderError field="newCredClientSecret" />
                  </>
                )}
              </FlatConnectSection>
            </FlatConnectForm>

            <createCredentials.RenderError />
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

            {isWindowOpen ? (
              <>
                {setupWindowBlocked && (
                  <>
                    <Text size="2" color="red600">
                      The popup window was blocked by your browser. Open it manually to
                      continue.
                    </Text>
                    <Spacer size={5} />
                  </>
                )}

                <Text size="2" weight="medium">
                  Continue in the authentication window
                </Text>

                <Spacer size={8} />

                <Flex gap={8} align="center">
                  {(onWindowOpenCancel ?? onCancel) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onWindowOpenCancel ?? onCancel}
                    >
                      {onWindowOpenCancel ? windowOpenCancelLabel : cancelLabel}
                    </Button>
                  )}

                  <Button
                    type="button"
                    onClick={() => {
                      if (!setupSession?.url) return;
                      let opened = openSetupWindow(setupSession.url);
                      setSetupWindowBlocked(!opened);
                    }}
                  >
                    Reopen Window
                  </Button>
                </Flex>
              </>
            ) : (
              <Flex gap={8} align="center">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    {cancelLabel}
                  </Button>
                )}
                <Button
                  type="submit"
                  loading={
                    isStarting || createSetupSession.isPending || createCredentials.isPending
                  }
                  disabled={
                    (isCreatingCredentials &&
                      (!credentialsForm.values.newCredName ||
                        !credentialsForm.values.newCredClientId ||
                        !credentialsForm.values.newCredClientSecret)) ||
                    (isCustomSelected &&
                      !isCreatingCredentials &&
                      !credentialsForm.values.selectedCredentialId)
                  }
                >
                  Continue
                </Button>
              </Flex>
            )}
          </form>
        );
      }
    };

    let connectStep = {
      title: 'Connect',
      subtitle: 'Complete authentication',
      render: () => {
        if (setupSession?.url) {
          return (
            <>
              {renderConnectSummary({ disabled: true })}

              {setupWindowBlocked && (
                <>
                  <Spacer size={5} />
                  <Text size="2" color="red600">
                    The popup window was blocked by your browser. Open it manually to continue.
                  </Text>
                </>
              )}

              <Spacer size={6} />

              <Text size="2" weight="strong">
                Continue in the {oauthMethodName} window
              </Text>
              <Text size="2" color="gray600">
                Complete the sign-in flow. This modal will update automatically.
              </Text>

              <Spacer size={8} />

              <Flex gap={8} align="center">
                {(onWindowOpenCancel ?? onCancel) && (
                  <Button size="1" variant="outline" onClick={onWindowOpenCancel ?? onCancel}>
                    {onWindowOpenCancel ? windowOpenCancelLabel : cancelLabel}
                  </Button>
                )}

                <Button
                  size="1"
                  onClick={() => {
                    let opened = openSetupWindow(setupSession.url!);
                    setSetupWindowBlocked(!opened);
                  }}
                >
                  Reopen Window
                </Button>
              </Flex>

              {(!skipMethodStep || onBackToMethodSelection) && (
                <>
                  <Spacer size={8} />
                  <span
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      resetSetupSession();
                      if (skipMethodStep) {
                        onBackToMethodSelection?.();
                        return;
                      }

                      setStep(0);
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
            {renderConnectSummary({ disabled: false })}

            <Spacer size={12} />

            <Text size="2" weight="strong">
              {isOAuth ? `Start Authentication` : 'Start setup'}
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

              {!isFirstVisibleStep && (
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

      if (usesFlattenedOAuthCredentialsStep) {
        return includeMethodStep
          ? [methodStep, flatOauthCredentialsStep]
          : [flatOauthCredentialsStep];
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
