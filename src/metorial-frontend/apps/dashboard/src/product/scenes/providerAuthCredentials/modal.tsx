import { DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderAuthCredentials,
  useProvider,
  useProviderAuthMethod,
  useProviderAuthMethods,
  useProviderDeployment,
  useProviderListing
} from '@metorial/state';
import {
  Button,
  Callout,
  CenteredSpinner,
  Copy,
  Dialog,
  Input,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { useEffect, useMemo, useState } from 'react';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import {
  getAuthMethodOAuthDoc,
  getAuthMethodOAuthScopesDoc,
  ProviderDocsLink
} from '../../lib/providerDocs';
import { ProviderContextCard } from '../providerContextCard';
import { resolveOAuthMethodState } from './oauthMethodSelection';
import { ScopePickerField } from './scopePicker';

export let ProviderAuthCredentialsForm = ({
  instanceId,
  providerId,
  deploymentId,
  providerAuthMethodId,
  close,
  onBack,
  onCreate,
  embedded = false,
  hideProviderContext = false,
  showScopePicker = false
}: {
  instanceId: string;
  providerId: string;
  deploymentId?: string;
  providerAuthMethodId?: string;
  close: () => void;
  onBack?: () => void;
  onCreate?: (
    credentials: DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput
  ) => void;
  embedded?: boolean;
  hideProviderContext?: boolean;
  showScopePicker?: boolean;
}) => {
  let effectiveHideProviderContext = hideProviderContext || !!deploymentId;
  let dismissSecondaryLabel = effectiveHideProviderContext ? 'Close' : 'Back';
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let provider = useProvider(instanceId, providerId);
  let versionId = deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(
    instanceId,
    !providerAuthMethodId && versionId ? { providerVersionId: versionId } : null
  );
  let selectedAuthMethod = useProviderAuthMethod(instanceId, providerAuthMethodId);
  let oauthMethodState = resolveOAuthMethodState({
    methods: authMethods.data?.items ?? [],
    selectedAuthMethodId: providerAuthMethodId,
    selectedAuthMethod: selectedAuthMethod.data,
    selectedAuthMethodLoading: selectedAuthMethod.isLoading,
    providerLoading: provider.isLoading,
    deploymentLoading: Boolean(deploymentId) && deployment.isLoading,
    authMethodsLoading: authMethods.isLoading
  });
  let oauthMethod = oauthMethodState.oauthMethod;
  let redirectUri = provider.data?.oauth?.callbackUrl;
  let providerName = deployment.data?.name ?? provider.data?.name ?? providerId;
  let oauthMethodName = oauthMethod?.name ?? 'OAuth';
  let authCreation = useProviderAuthCreationCapabilities(instanceId, deploymentId, providerId);
  let providerListing = useProviderListing(instanceId, providerId);
  let oauthDoc = getAuthMethodOAuthDoc(providerListing.data, oauthMethod);
  let oauthScopesDoc = getAuthMethodOAuthScopesDoc(providerListing.data, oauthMethod);
  let availableScopes = oauthMethod?.scopes ?? [];
  let defaultScopes = useMemo(
    () => availableScopes.map(scope => scope.scope),
    [availableScopes]
  );
  let [selectedScopes, setSelectedScopes] = useState<string[] | null>(null);
  let effectiveScopes = selectedScopes ?? defaultScopes;

  let createCredentials = useCreateProviderAuthCredentials();

  let form = useForm({
    initialValues: {
      name: '',
      clientId: '',
      clientSecret: ''
    },
    onSubmit: async values => {
      let [result, err] = await createCredentials.mutate({
        instanceId,
        providerId,
        name: values.name.trim(),
        config: {
          type: 'oauth',
          clientId: values.clientId,
          clientSecret: values.clientSecret,
          scopes: effectiveScopes
        }
      });

      if (err || !result) return;

      onCreate?.(result);
      close();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        clientId: yup.string().required('Client ID is required'),
        clientSecret: yup.string().required('Client Secret is required')
      })
  });

  useEffect(() => {
    setSelectedScopes(null);
  }, [oauthMethod?.id]);

  if (authCreation.isLoading || oauthMethodState.isLoading) {
    return (
      <>
        <Dialog.Title>Create Auth Credentials</Dialog.Title>
        <Dialog.Description>Loading provider details...</Dialog.Description>
        <Spacer size={15} />
        <CenteredSpinner />
      </>
    );
  }

  if (!authCreation.canCreateAuthCredentials) {
    return (
      <>
        {!embedded && (
          <>
            <Dialog.Title>Create Auth Credentials</Dialog.Title>
            <Dialog.Description>
              Select a provider and create OAuth credentials.
            </Dialog.Description>
            <Spacer size={15} />
          </>
        )}

        {!effectiveHideProviderContext && (
          <>
            <ProviderContextCard
              providerId={providerId}
              providerName={provider.data?.name ?? providerName}
              providerImageUrl={provider.data?.publisher.imageUrl}
              deploymentName={deployment.data?.name}
              deploymentDescription={deployment.data?.description}
            />

            <Spacer size={15} />
          </>
        )}

        <Callout color="gray">
          {authCreation.authCredentialsDisabledReason ??
            'This provider does not support creating auth credentials.'}
        </Callout>

        <Spacer size={15} />

        <Dialog.Actions>
          {onBack && (
            <Button type="button" size="2" variant="outline" onClick={onBack}>
              {dismissSecondaryLabel}
            </Button>
          )}
          <Button type="button" size="2" onClick={close}>
            {onBack ? 'Cancel' : 'Close'}
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  if (oauthMethodState.isUnavailable) {
    return (
      <>
        {!embedded && (
          <>
            <Dialog.Title>Create Auth Credentials</Dialog.Title>
            <Dialog.Description>
              Enter OAuth app credentials for {providerName}.
            </Dialog.Description>
            <Spacer size={15} />
          </>
        )}

        {!effectiveHideProviderContext && (
          <>
            <ProviderContextCard
              providerId={providerId}
              providerName={provider.data?.name ?? providerName}
              providerImageUrl={provider.data?.publisher.imageUrl}
              deploymentName={deployment.data?.name}
              deploymentDescription={deployment.data?.description}
            />

            <Spacer size={15} />
          </>
        )}

        <Callout color="gray">
          The selected OAuth method is unavailable. Go back and choose another OAuth method
          before creating credentials.
        </Callout>

        <Spacer size={15} />

        <Dialog.Actions>
          {onBack && (
            <Button type="button" size="2" variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="button" size="2" onClick={close}>
            Close
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  return (
    <>
      {!embedded && (
        <>
          <Dialog.Title>Create Auth Credentials</Dialog.Title>
          <Dialog.Description>
            Enter your {oauthMethodName} app credentials for {providerName}.
          </Dialog.Description>
        </>
      )}

      {!effectiveHideProviderContext && (
        <>
          <ProviderContextCard
            providerId={providerId}
            providerName={provider.data?.name ?? providerName}
            providerImageUrl={provider.data?.publisher.imageUrl}
            deploymentName={deployment.data?.name}
            deploymentDescription={deployment.data?.description}
          />

          <Spacer size={15} />
        </>
      )}

      <form onSubmit={form.handleSubmit}>
        {redirectUri && (
          <>
            <Text size="1" weight="medium" color="gray900">
              Redirect URI
            </Text>
            <Text size="1" color="gray600" style={{ marginBottom: 5 }}>
              <span>
                You must configure this redirect URI in your OAuth app.
                {oauthDoc ? (
                  <>
                    {' '}
                    <ProviderDocsLink doc={oauthDoc} />
                  </>
                ) : null}
              </span>
            </Text>
            <Copy value={redirectUri} />
            <Spacer size={10} />
          </>
        )}

        <Input
          label="Name"
          placeholder="My OAuth App"
          required
          {...form.getFieldProps('name')}
        />
        <form.RenderError field="name" />

        <Spacer size={10} />

        <Input
          label="Client ID"
          placeholder="Enter client ID from provider"
          help={<ProviderDocsLink doc={oauthDoc} />}
          required
          {...form.getFieldProps('clientId')}
        />
        <form.RenderError field="clientId" />

        <Spacer size={10} />

        <Input
          label="Client Secret"
          placeholder="Enter client secret from provider"
          type="password"
          required
          {...form.getFieldProps('clientSecret')}
        />
        <form.RenderError field="clientSecret" />

        {showScopePicker && availableScopes.length > 0 && (
          <>
            <Spacer size={10} />
            <ScopePickerField
              scopes={availableScopes}
              selectedScopes={effectiveScopes}
              onSelectedScopesChange={setSelectedScopes}
              help={<ProviderDocsLink doc={oauthScopesDoc} />}
            />
          </>
        )}

        <createCredentials.RenderError />

        <Spacer size={15} />

        <Dialog.Actions>
          {onBack && (
            <Button type="button" size="2" variant="outline" onClick={onBack}>
              {dismissSecondaryLabel}
            </Button>
          )}
          <Button
            type="submit"
            size="2"
            loading={createCredentials.isPending}
            disabled={!form.values.name || !form.values.clientId || !form.values.clientSecret}
          >
            Create
          </Button>
        </Dialog.Actions>
      </form>
    </>
  );
};

export let showProviderAuthCredentialsFormModal = (p: {
  instanceId: string;
  providerId: string;
  deploymentId?: string;
  providerAuthMethodId?: string;
  onBack?: () => void;
  onCreate?: (
    credentials: DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput
  ) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={800}>
      <ProviderAuthCredentialsForm
        {...p}
        close={close}
        onBack={p.onBack}
        onCreate={p.onCreate}
      />
    </Dialog.Wrapper>
  ));
