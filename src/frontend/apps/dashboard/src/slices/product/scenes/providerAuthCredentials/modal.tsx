import {
  DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput,
  DashboardInstanceProvidersAuthMethodsListOutput
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderAuthCredentials,
  useProvider,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import {
  Button,
  CenteredSpinner,
  Copy,
  Dialog,
  Input,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { useMemo } from 'react';

type AuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];

export let ProviderAuthCredentialsForm = ({
  instanceId,
  providerId,
  deploymentId,
  close,
  onBack,
  onCreate
}: {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  close: () => void;
  onBack?: () => void;
  onCreate?: (credentials: DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput) => void;
}) => {
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let provider = useProvider(instanceId, providerId);
  let versionId = deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(instanceId, versionId);
  let oauthMethod = useMemo(
    () => (authMethods.data?.items ?? []).find((method: AuthMethod) => method.type === 'oauth'),
    [authMethods.data?.items]
  );
  let redirectUri = provider.data?.oauth?.callbackUrl;
  let providerName = deployment.data?.name ?? provider.data?.name ?? providerId;
  let oauthMethodName = oauthMethod?.name ?? 'OAuth';
  let oauthAutoRegistrationEnabled =
    provider.data?.oauth?.autoRegistration?.status === 'enabled';

  let createCredentials = useCreateProviderAuthCredentials();

  let form = useForm({
    initialValues: {
      name: '',
      clientId: '',
      clientSecret: ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        clientId: yup.string().required('Client ID is required'),
        clientSecret: yup.string().required('Client Secret is required')
      })
  });

  let handleSubmit = async () => {
    let name = form.values.name.trim();

    if (!name) {
      form.setFieldTouched('name', true);
      form.setFieldError('name', 'Name is required');
      return;
    }

    form.setFieldError('name', undefined);

    let [result, err] = await createCredentials.mutate({
      instanceId,
      providerId,
      name,
      config: {
        type: 'oauth',
        clientId: form.values.clientId,
        clientSecret: form.values.clientSecret,
        scopes: oauthMethod?.scopes?.map(scope => scope.scope) ?? []
      }
    });

    if (err || !result) return;

    onCreate?.(result);
    close();
  };

  if (deployment.isLoading || authMethods.isLoading) {
    return (
      <>
        <Dialog.Title>Create Auth Credentials</Dialog.Title>
        <Dialog.Description>Loading provider details...</Dialog.Description>
        <Spacer size={15} />
        <CenteredSpinner />
      </>
    );
  }

  if (oauthAutoRegistrationEnabled) {
    return (
      <>
        <Dialog.Title>Create Auth Credentials</Dialog.Title>
        <Dialog.Description>
          {providerName} uses {oauthMethodName} auto-registration, so manual app
          credentials are not supported for this provider.
        </Dialog.Description>

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
      <Dialog.Title>Create Auth Credentials</Dialog.Title>
      <Dialog.Description>
        Enter your {oauthMethodName} app credentials for {providerName}.
      </Dialog.Description>

      <Spacer size={15} />

      <form
        onSubmit={e => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {redirectUri && (
          <>
            <Copy label="Redirect URI" value={redirectUri} />
            <Text size="1" color="gray600">
              Use this redirect URI when configuring your OAuth app.
            </Text>

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

        <createCredentials.RenderError />

        <Spacer size={15} />

        <Dialog.Actions>
          {onBack && (
            <Button type="button" size="2" variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="button" size="2" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            size="2"
            onClick={handleSubmit}
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
  deploymentId: string;
  onBack?: () => void;
  onCreate?: (credentials: DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <ProviderAuthCredentialsForm
        {...p}
        close={close}
        onBack={p.onBack}
        onCreate={p.onCreate}
      />
    </Dialog.Wrapper>
  ));
