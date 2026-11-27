import { useForm } from '@metorial/data-hooks';
import {
  instanceProviderAuthConfigsLoader,
  useCreateProviderAuthCredentials,
  useProvider,
  useProviderAuthCredentials,
  useProviderListing
} from '@metorial/state';
import {
  Button,
  Callout,
  CenteredSpinner,
  Checkbox,
  Copy,
  Dialog,
  Flex,
  Input,
  InputLabel,
  Spacer,
  Text
} from '@metorial/ui';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthMethodOAuthDoc, ProviderDocsLink } from '../../lib/providerDocs';
import { getProviderOAuthAutoRegistrationEnabled } from '../../lib/providerOAuthAutoRegistration';
import {
  type SetupSessionCredentialError,
  useProviderSetupSessionRunner
} from '../providerDeployments/setupSessionRunner';
import {
  CREDENTIALS_SEARCH_THRESHOLD,
  getPreferredProviderAuthCredential,
  getProviderAuthCredentialsQuery,
  getRememberedProviderAuthCredentialId,
  NEW_CREDENTIALS_ID,
  type ProviderAuthCredential,
  ProviderAuthCredentialPicker,
  rememberProviderAuthCredentialChoice
} from './credentialPicker';
import { type AuthMethod, getGeneratedAuthConfigName } from './modalHelpers';

export type CreatedAuthConfig = { id: string; name?: string | null };

let NewCredentialsFields = (p: {
  form: ReturnType<typeof useNewCredentialsForm>;
  redirectUri?: string | null;
  oauthDoc: ReturnType<typeof getAuthMethodOAuthDoc>;
  disabled?: boolean;
}) => (
  <Flex direction="column" gap={12}>
    {p.redirectUri && (
      <div>
        <InputLabel as="div">Redirect URI</InputLabel>
        <Text size="1" color="gray600" style={{ marginBottom: 6 }}>
          Add this redirect URI to your OAuth app.{' '}
          {p.oauthDoc && <ProviderDocsLink doc={p.oauthDoc} />}
        </Text>
        <Copy value={p.redirectUri} />
      </div>
    )}

    <div>
      <Input
        label="Client ID"
        placeholder="Enter client ID from provider"
        disabled={p.disabled}
        {...p.form.getFieldProps('clientId')}
      />
      <p.form.RenderError field="clientId" />
    </div>

    <div>
      <Input
        label="Client Secret"
        placeholder="Enter client secret from provider"
        type="password"
        disabled={p.disabled}
        {...p.form.getFieldProps('clientSecret')}
      />
      <p.form.RenderError field="clientSecret" />
    </div>

    <div>
      <Input
        label="Name"
        description="Optional, helps you recognize these credentials later."
        placeholder="My OAuth App"
        disabled={p.disabled}
        {...p.form.getFieldProps('name')}
      />
    </div>
  </Flex>
);

let useNewCredentialsForm = (defaultName = '') =>
  useForm({
    initialValues: { name: defaultName, clientId: '', clientSecret: '' },
    updateInitialValues: true,
    onSubmit: async () => undefined,
    schema: yup =>
      yup.object({
        name: yup.string(),
        clientId: yup.string().trim().required('Client ID is required'),
        clientSecret: yup.string().trim().required('Client secret is required')
      })
  });

export let ProviderOAuthAuthenticateContent = (p: {
  instanceId: string;
  providerId: string;
  providerDeploymentId?: string;
  method: AuthMethod;
  fixedAuthCredentialsId?: string;
  fixedAuthCredentialsSettingsHref?: string;
  credentialError?: SetupSessionCredentialError;
  defaultAuthConfigName?: string;
  source?: 'explorer';
  embedded?: boolean;
  cancelLabel?: string;
  onCancel: () => void;
  onCreate: (authConfig: CreatedAuthConfig) => void;
  onWindowOpenStateChange?: (isOpen: boolean) => void;
}) => {
  let provider = useProvider(p.instanceId, p.providerId);
  let providerListing = useProviderListing(p.instanceId, p.providerId);
  let providerName = providerListing.data?.name ?? provider.data?.name ?? 'Provider';
  let oauthAutoRegistrationEnabled = getProviderOAuthAutoRegistrationEnabled(provider.data);
  let needsCredentials = !oauthAutoRegistrationEnabled && !p.fixedAuthCredentialsId;

  let credentials = useProviderAuthCredentials(
    p.instanceId,
    needsCredentials
      ? getProviderAuthCredentialsQuery({
          providerId: p.providerId,
          providerAuthMethodId: p.method.id
        })
      : null
  );
  let [rejectedCredentialIds, setRejectedCredentialIds] = useState<string[]>(() =>
    p.credentialError?.credentialId ? [p.credentialError.credentialId] : []
  );
  let [hasCredentialError, setHasCredentialError] = useState(!!p.credentialError);
  let [projectCredentialsBlocked, setProjectCredentialsBlocked] = useState(false);
  let [createdCredential, setCreatedCredential] = useState<ProviderAuthCredential | null>(
    null
  );
  let listedCredentials = credentials.data?.items ?? [];
  let initialCredentials = (
    createdCredential &&
    !listedCredentials.some(credential => credential.id === createdCredential.id)
      ? [createdCredential, ...listedCredentials]
      : listedCredentials
  ).filter(credential => !rejectedCredentialIds.includes(credential.id));
  let searchable =
    initialCredentials.length > CREDENTIALS_SEARCH_THRESHOLD ||
    !!credentials.data?.pagination.hasMoreAfter ||
    !!credentials.data?.pagination.hasMoreBefore;
  let hasMoreCredentials =
    !!credentials.data?.pagination.hasMoreAfter ||
    !!credentials.data?.pagination.hasMoreBefore;
  let hasCredentials = initialCredentials.length > 0 || hasMoreCredentials;
  let rememberedCredentialId = getRememberedProviderAuthCredentialId(initialCredentials);

  let authConfigName = useMemo(
    () => getGeneratedAuthConfigName(p.defaultAuthConfigName, providerName),
    [p.defaultAuthConfigName, providerName]
  );
  let [credentialChoice, setCredentialChoice] = useState<string | null>(null);
  let [rememberChoice, setRememberChoice] = useState<boolean | null>(null);
  let selectedCredentialId =
    credentialChoice ??
    rememberedCredentialId ??
    getPreferredProviderAuthCredential(initialCredentials)?.id ??
    null;

  useEffect(() => {
    if (p.credentialError && needsCredentials) void credentials.refetch();
  }, [p.credentialError, needsCredentials]);

  let showCredentialPicker =
    hasMoreCredentials ||
    initialCredentials.length > 1 ||
    credentialChoice === NEW_CREDENTIALS_ID;
  let isCreatingCredentials =
    !projectCredentialsBlocked &&
    (!hasCredentials || selectedCredentialId === NEW_CREDENTIALS_ID);
  let requiresAdmin =
    (hasCredentialError && !needsCredentials) ||
    (projectCredentialsBlocked && !hasCredentials);
  let newCredentialsForm = useNewCredentialsForm(`${providerName} OAuth App`);
  let createCredentials = useCreateProviderAuthCredentials();

  let runner = useProviderSetupSessionRunner({
    instanceId: p.instanceId,
    providerId: p.providerId,
    providerDeploymentId: p.providerDeploymentId,
    source: p.source,
    onCredentialError: ({ credentialId }) => {
      setHasCredentialError(true);
      if (!needsCredentials) return;

      if (credentialId) {
        setRejectedCredentialIds(ids => [...ids, credentialId]);
        setCredentialChoice(null);
        if (credentials.data) {
          rememberProviderAuthCredentialChoice(credentials.data.items, null);
        }
      }
      setRememberChoice(false);
      void credentials.refetch();
    },
    onComplete: setupSession => {
      if (!setupSession.authConfig) return;
      void instanceProviderAuthConfigsLoader.refetchAll();
      p.onCreate(setupSession.authConfig);
    }
  });

  let isWindowOpen = runner.isAwaitingCompletion;
  useEffect(() => {
    p.onWindowOpenStateChange?.(isWindowOpen);
  }, [isWindowOpen]);

  let isBusy = runner.isStarting || createCredentials.isLoading;

  let createNewCredentials = async () => {
    let [result, error] = await createCredentials.mutate({
      instanceId: p.instanceId,
      providerId: p.providerId,
      name: newCredentialsForm.values.name.trim() || `${providerName} OAuth App`,
      config: {
        type: 'oauth',
        clientId: newCredentialsForm.values.clientId.trim(),
        clientSecret: newCredentialsForm.values.clientSecret.trim(),
        scopes: p.method.scopes?.map(scope => scope.scope) ?? []
      }
    });

    if (!result) {
      if (error?.data.code === 'project_auth_credentials_not_allowed') {
        setProjectCredentialsBlocked(true);
        setCredentialChoice(null);
        void credentials.refetch();
      }
      return null;
    }

    newCredentialsForm.resetForm();
    setCreatedCredential(result);
    setCredentialChoice(result.id);
    return result.id;
  };

  let handleContinue = async (e: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (
      typeof document != 'undefined' &&
      document.activeElement instanceof HTMLInputElement &&
      document.activeElement.type == 'search'
    ) {
      return;
    }
    if (isBusy || requiresAdmin || (needsCredentials && !credentials.data)) return;

    if (needsCredentials && isCreatingCredentials) {
      let { clientId, clientSecret } = newCredentialsForm.values;
      if (!clientId.trim() || !clientSecret.trim()) {
        void newCredentialsForm.setTouched({ clientId: true, clientSecret: true }, true);
        return;
      }

      await runner.start({
        providerAuthMethodId: p.method.id,
        name: authConfigName,
        resolveProviderAuthCredentialsId: createNewCredentials
      });
      return;
    }

    let providerAuthCredentialsId =
      p.fixedAuthCredentialsId ?? selectedCredentialId ?? undefined;
    if (needsCredentials && !providerAuthCredentialsId) return;

    let result = await runner.start({
      providerAuthMethodId: p.method.id,
      providerAuthCredentialsId,
      name: authConfigName
    });

    if (result && needsCredentials) {
      rememberProviderAuthCredentialChoice(
        initialCredentials,
        (rememberChoice ?? !!rememberedCredentialId) ? providerAuthCredentialsId! : null
      );
    }
  };

  let title = p.embedded ? null : (
    <>
      <Dialog.Title>Authenticate with {providerName}</Dialog.Title>
      <Dialog.Description>
        {isWindowOpen
          ? 'Finish signing in from the authentication window.'
          : requiresAdmin
            ? 'Update the OAuth app settings to continue.'
            : isCreatingCredentials && needsCredentials
              ? `Add an OAuth app for ${p.method.name} to sign in.`
              : 'A new window will open for you to sign in.'}
      </Dialog.Description>
      <Spacer size={16} />
    </>
  );

  if (provider.isLoading || (needsCredentials && credentials.isLoading && !credentials.data)) {
    return (
      <>
        {p.embedded ? null : <Dialog.Title>Authenticate</Dialog.Title>}
        <CenteredSpinner />
      </>
    );
  }

  let errorMessage = runner.error ? (
    <Text size="2" color="red600" style={{ marginTop: 12 }}>
      {runner.error}
    </Text>
  ) : null;

  if (needsCredentials && !credentials.data && credentials.error) {
    return (
      <>
        {title}
        <Callout color="orange">
          Could not load OAuth apps for this authentication method.
        </Callout>
        <Spacer size={16} />
        <Dialog.Actions>
          <Button variant="outline" onClick={p.onCancel}>
            {p.cancelLabel ?? 'Cancel'}
          </Button>
          <Button onClick={() => credentials.refetch()}>Try Again</Button>
        </Dialog.Actions>
      </>
    );
  }

  if (isWindowOpen) {
    return (
      <>
        {title}

        <Text size="2" weight="strong">
          Continue in the authentication window
        </Text>
        <Text size="2" color="gray600">
          This will update automatically once you have signed in.
        </Text>

        {runner.windowBlocked && (
          <Text size="2" color="red600" style={{ marginTop: 8 }}>
            Your browser blocked the authentication window. Open it manually to continue.
          </Text>
        )}

        {errorMessage}

        <Spacer size={16} />

        <Dialog.Actions>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              runner.reset();
              p.onCancel();
            }}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => runner.openWindow()}>
            Reopen Window
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  let redirectUri = provider.data?.oauth?.callbackUrl;
  let oauthDoc = getAuthMethodOAuthDoc(providerListing.data, p.method);
  let newCredentialsFields = (
    <NewCredentialsFields
      form={newCredentialsForm}
      redirectUri={redirectUri}
      oauthDoc={oauthDoc}
      disabled={isBusy}
    />
  );

  return (
    <form onSubmit={handleContinue}>
      {title}

      {requiresAdmin ? (
        <Callout color="orange">
          {p.fixedAuthCredentialsId
            ? `This integration’s OAuth app is unavailable for ${p.method.name}. Update the app in the integration’s provider settings to continue.`
            : projectCredentialsBlocked
              ? `Ask your installation administrator to configure an OAuth app for ${p.method.name}.`
              : `Automatic sign-in is unavailable for ${p.method.name}. Ask your administrator to check this provider’s OAuth settings.`}
        </Callout>
      ) : hasCredentialError || projectCredentialsBlocked ? (
        <Callout color="orange">
          {projectCredentialsBlocked
            ? 'Your installation administrator manages OAuth apps. Use an available app to continue.'
            : hasCredentials
              ? 'The previous OAuth app is unavailable. Continue with an available app.'
              : 'No OAuth app is available for this method. Add your own app to continue.'}
        </Callout>
      ) : null}

      {needsCredentials &&
        !requiresAdmin &&
        (showCredentialPicker ? (
          <ProviderAuthCredentialPicker
            instanceId={p.instanceId}
            providerId={p.providerId}
            providerAuthMethodId={p.method.id}
            searchable={searchable}
            value={selectedCredentialId}
            onChange={value => {
              setCredentialChoice(value);
              runner.setError(null);
            }}
            disabled={isBusy}
            allowNewCredentials={!projectCredentialsBlocked}
            rejectedCredentialIds={rejectedCredentialIds}
          >
            {newCredentialsFields}
          </ProviderAuthCredentialPicker>
        ) : isCreatingCredentials ? (
          newCredentialsFields
        ) : initialCredentials[0] ? (
          <Text size="2" color="gray600">
            OAuth app <strong>{initialCredentials[0].name ?? initialCredentials[0].id}</strong>
          </Text>
        ) : null)}

      {needsCredentials &&
        initialCredentials.length > 1 &&
        selectedCredentialId &&
        !isCreatingCredentials && (
          <div style={{ marginTop: 16 }}>
            <Checkbox
              label="Remember My Choice"
              checked={rememberChoice ?? !!rememberedCredentialId}
              onCheckedChange={setRememberChoice}
              disabled={isBusy}
            />
          </div>
        )}

      {!projectCredentialsBlocked && <createCredentials.RenderError />}
      {errorMessage}

      <Spacer size={20} />

      <Dialog.Actions>
        <Button type="button" variant="outline" disabled={isBusy} onClick={p.onCancel}>
          {p.cancelLabel ?? 'Cancel'}
        </Button>
        {requiresAdmin ? (
          p.fixedAuthCredentialsSettingsHref && (
            <Link to={p.fixedAuthCredentialsSettingsHref} onClick={p.onCancel}>
              Open Integration
            </Link>
          )
        ) : (
          <Button
            type="submit"
            loading={isBusy}
            disabled={needsCredentials && !isCreatingCredentials && !selectedCredentialId}
          >
            {needsCredentials && isCreatingCredentials
              ? 'Add App and Authenticate'
              : 'Authenticate'}
          </Button>
        )}
      </Dialog.Actions>
    </form>
  );
};
