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
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { getAuthMethodOAuthDoc, ProviderDocsLink } from '../../lib/providerDocs';
import { getProviderOAuthAutoRegistrationEnabled } from '../../lib/providerOAuthAutoRegistration';
import { useProviderSetupSessionRunner } from '../providerDeployments/setupSessionRunner';
import {
  CREDENTIALS_SEARCH_THRESHOLD,
  getPreferredProviderAuthCredential,
  getProviderAuthCredentialsQuery,
  getRememberedProviderAuthCredentialId,
  NEW_CREDENTIALS_ID,
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
  let initialCredentials = credentials.data?.items ?? [];
  let hasCredentials = initialCredentials.length > 0;
  let searchable =
    initialCredentials.length > CREDENTIALS_SEARCH_THRESHOLD ||
    !!credentials.data?.pagination.hasMoreAfter;

  let [authConfigName] = useState(() =>
    getGeneratedAuthConfigName(p.defaultAuthConfigName, providerName)
  );
  let [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  let [rememberChoice, setRememberChoice] = useState(false);
  let hasInitializedSelectionRef = useRef(false);

  useEffect(() => {
    if (hasInitializedSelectionRef.current || !credentials.data) return;
    hasInitializedSelectionRef.current = true;
    let remembered = getRememberedProviderAuthCredentialId(credentials.data.items);
    setRememberChoice(!!remembered);
    setSelectedCredentialId(
      remembered ?? getPreferredProviderAuthCredential(credentials.data.items)?.id ?? null
    );
  }, [credentials.data]);

  let isCreatingCredentials = !hasCredentials || selectedCredentialId == NEW_CREDENTIALS_ID;
  let newCredentialsForm = useNewCredentialsForm(`${providerName} OAuth App`);
  let createCredentials = useCreateProviderAuthCredentials();

  let runner = useProviderSetupSessionRunner({
    instanceId: p.instanceId,
    providerId: p.providerId,
    providerDeploymentId: p.providerDeploymentId,
    source: p.source,
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
    let [result] = await createCredentials.mutate({
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

    if (!result) return null;

    newCredentialsForm.resetForm();
    setSelectedCredentialId(result.id);
    return result.id;
  };

  let handleContinue = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (
      typeof document != 'undefined' &&
      document.activeElement instanceof HTMLInputElement &&
      document.activeElement.type == 'search'
    ) {
      return;
    }
    if (isBusy) return;

    if (needsCredentials && isCreatingCredentials) {
      let { clientId, clientSecret } = newCredentialsForm.values;
      if (!clientId.trim() || !clientSecret.trim()) {
        void newCredentialsForm.setTouched({ clientId: true, clientSecret: true }, true);
        return;
      }

      void runner.start({
        providerAuthMethodId: p.method.id,
        name: authConfigName,
        resolveProviderAuthCredentialsId: createNewCredentials
      });
      return;
    }

    let providerAuthCredentialsId =
      p.fixedAuthCredentialsId ?? selectedCredentialId ?? undefined;
    if (needsCredentials && !providerAuthCredentialsId) return;

    if (needsCredentials) {
      rememberProviderAuthCredentialChoice(
        initialCredentials,
        rememberChoice ? providerAuthCredentialsId! : null
      );
    }

    void runner.start({
      providerAuthMethodId: p.method.id,
      providerAuthCredentialsId,
      name: authConfigName
    });
  };

  let title = p.embedded ? null : (
    <>
      <Dialog.Title>Authenticate with {providerName}</Dialog.Title>
      <Dialog.Description>
        {isWindowOpen
          ? 'Finish signing in from the authentication window.'
          : needsCredentials && !hasCredentials
            ? `Connect your ${providerName} OAuth app to continue.`
            : `A new window will open so you can sign in to ${providerName}.`}
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

      {needsCredentials &&
        (hasCredentials ? (
          <ProviderAuthCredentialPicker
            instanceId={p.instanceId}
            providerId={p.providerId}
            providerAuthMethodId={p.method.id}
            searchable={searchable}
            value={selectedCredentialId}
            onChange={setSelectedCredentialId}
            disabled={isBusy}
          >
            {newCredentialsFields}
          </ProviderAuthCredentialPicker>
        ) : (
          newCredentialsFields
        ))}

      {needsCredentials &&
        initialCredentials.length > 1 &&
        selectedCredentialId &&
        !isCreatingCredentials && (
          <div style={{ marginTop: 16 }}>
            <Checkbox
              label="Remember My Choice"
              checked={rememberChoice}
              onCheckedChange={setRememberChoice}
              disabled={isBusy}
            />
          </div>
        )}

      <createCredentials.RenderError />
      {errorMessage}

      <Spacer size={20} />

      <Dialog.Actions>
        <Button type="button" variant="outline" disabled={isBusy} onClick={p.onCancel}>
          {p.cancelLabel ?? 'Cancel'}
        </Button>
        <Button
          type="submit"
          loading={isBusy}
          disabled={needsCredentials && !isCreatingCredentials && !selectedCredentialId}
        >
          Continue
        </Button>
      </Dialog.Actions>
    </form>
  );
};
