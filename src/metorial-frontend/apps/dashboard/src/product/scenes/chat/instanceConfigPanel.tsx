import { renderWithLoader, useForm } from '@metorial/data-hooks';
import {
  useChatConnection,
  useChatInstance,
  useChatInstanceAuthenticatedUser,
  useChatInstanceProvider,
  useCreateChatInstance,
  useCreateProviderConfig,
  useProviderAuthMethods,
  useSetChatInstanceProvider,
  type ChatConnectionProvider,
  type ChatInstance
} from '@metorial/state';
import {
  Avatar,
  Button,
  Callout,
  CenteredSpinner,
  Dialog,
  Flex,
  Input,
  Panel,
  Spacer,
  Text
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  emptyConfigurationSelection,
  type ConfigurationSelection
} from '../../lib/configSelection';
import { useProviderSetupVisibility } from '../integrations/providerPanelFlow';
import { showProviderCreationPanel } from '../providerCreationPanel';
import { ProviderSetupSections } from '../sessionTemplates/addProviderPanelFlow';
import { generatePlaceholderInstanceName } from './shared';

type ChatInstanceProviderFormValues = {
  selectedConfiguration: ConfigurationSelection;
  selectedAuthConfigId: string;
};

type ProviderSubmitResult = {
  providerConfigId?: string;
  providerAuthConfigId?: string;
};

let isConfigSelectionComplete = (selection: ConfigurationSelection) =>
  selection.kind !== 'none';

export let ChatInstanceSettingsSection = (p: {
  instanceId: string;
  chatInstance: ChatInstance;
}) => {
  let chatInstance = useChatInstance(p.instanceId, p.chatInstance.id);
  let updateMutator = chatInstance.useUpdateMutator();

  let form = useForm({
    initialValues: {
      name: p.chatInstance.name,
      description: p.chatInstance.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || null
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });

  return (
    <Box title="Settings" description="The name and description shown for this instance.">
      <form onSubmit={form.handleSubmit}>
        <Input label="Name" {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Spacer size={15} />

        <Input label="Description" {...form.getFieldProps('description')} />
        <form.RenderError field="description" />

        <Spacer size={15} />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="2"
            type="submit"
            loading={updateMutator.isLoading}
            success={updateMutator.isSuccess}
          >
            Save
          </Button>
        </div>

        <updateMutator.RenderError />
      </form>
    </Box>
  );
};

export let ChatInstanceConnectedAsSection = (p: {
  instanceId: string;
  chatInstanceId: string;
}) => {
  let authenticatedUser = useChatInstanceAuthenticatedUser(p.instanceId, p.chatInstanceId);

  return (
    <Box
      title="Connected As"
      description="The chat account this instance acts as when it reads and sends messages."
    >
      {authenticatedUser.data ? (
        <Flex align="center" gap={12}>
          <Avatar
            entity={{
              name: authenticatedUser.data.fullName || authenticatedUser.data.userName,
              photoUrl: authenticatedUser.data.imageUrl ?? undefined
            }}
            size={36}
            noTooltip
          />

          <div>
            <Text size="2" weight="strong">
              {authenticatedUser.data.fullName || authenticatedUser.data.userName}
            </Text>
            <Text size="1" color="gray600">
              {[
                authenticatedUser.data.email,
                authenticatedUser.data.workspace?.name ??
                  authenticatedUser.data.workspace?.domain
              ]
                .filter(Boolean)
                .join(' · ') || authenticatedUser.data.providerAuthorId}
            </Text>
          </div>
        </Flex>
      ) : authenticatedUser.isLoading ? (
        <Text size="2" color="gray600">
          Loading account...
        </Text>
      ) : (
        <Text size="2" color="gray600">
          The connected account could not be loaded.
        </Text>
      )}
    </Box>
  );
};

// Shared auth/config form for both the create-first flow (no chat instance exists yet)
// and the update flow (an existing instance's provider is being reconfigured). The two
// flows only differ in what happens on submit, supplied via `onSubmit`.
let ChatInstanceProviderConfigurator = (p: {
  instanceId: string;
  chatConnectionProvider: ChatConnectionProvider;
  instanceConfigId: string | null;
  initialAuthConfigId: string;
  isUpdate: boolean;
  isSaving: boolean;
  saveLabel: string;
  extraError?: ReactNode;
  onSubmit: (result: ProviderSubmitResult) => Promise<boolean>;
}) => {
  let providerId = p.chatConnectionProvider.provider.id;
  let createConfig = useCreateProviderConfig();
  let autoSubmitAttemptedRef = useRef(false);
  let inheritedConfigId = p.chatConnectionProvider.config?.id ?? null;
  let visibility = useProviderSetupVisibility({
    instanceId: p.instanceId,
    providerId,
    integration: null,
    existingConfigId: p.instanceConfigId ?? inheritedConfigId,
    inheritedConfigId,
    instanceConfigId: p.instanceConfigId,
    hideToolFilters: true,
    isUpdate: p.isUpdate
  });
  let inheritedAuthMethodId = p.chatConnectionProvider.authMethodId ?? undefined;
  let inheritedAuthMethods = useProviderAuthMethods(
    p.instanceId,
    inheritedAuthMethodId && visibility.provider.data?.currentVersion?.id
      ? { providerVersionId: visibility.provider.data.currentVersion.id }
      : null
  );
  let fixedAuthMethodId =
    inheritedAuthMethodId &&
    (inheritedAuthMethods.data?.items ?? []).some(
      method => method.id === inheritedAuthMethodId
    )
      ? inheritedAuthMethodId
      : undefined;
  let isInheritedAuthMethodLoading = Boolean(
    inheritedAuthMethodId &&
    visibility.provider.data?.currentVersion?.id &&
    inheritedAuthMethods.isLoading
  );

  let submit = async (values: ChatInstanceProviderFormValues) => {
    let providerConfigId =
      values.selectedConfiguration.kind === 'config'
        ? values.selectedConfiguration.id
        : undefined;

    if (!providerConfigId && visibility.shouldAutoCreateEmptyConfig) {
      let [config] = await createConfig.mutate({
        instanceId: p.instanceId,
        providerId,
        name: `${visibility.providerName} Config`,
        value: visibility.defaultConfigValue
      });
      providerConfigId = config?.id;
    }

    return p.onSubmit({
      providerConfigId,
      providerAuthConfigId: values.selectedAuthConfigId || undefined
    });
  };

  let initialConfigId = p.instanceConfigId ?? inheritedConfigId;

  let form = useForm<ChatInstanceProviderFormValues, ChatInstanceProviderFormValues>({
    initialValues: {
      selectedConfiguration: initialConfigId
        ? { kind: 'config', id: initialConfigId }
        : emptyConfigurationSelection(),
      selectedAuthConfigId: p.initialAuthConfigId
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (
        visibility.configRequirement === 'required' &&
        !isConfigSelectionComplete(values.selectedConfiguration)
      ) {
        form.setFieldTouched('selectedConfiguration', true, false);
        form.setFieldError('selectedConfiguration', 'Select a config');
        return;
      }

      if (visibility.showAuth && !values.selectedAuthConfigId) {
        form.setFieldTouched('selectedAuthConfigId', true, false);
        form.setFieldError('selectedAuthConfigId', 'Connect a chat account');
        return;
      }

      await submit(values);
    },
    schema: yup =>
      yup.object({
        selectedConfiguration: yup.mixed<ConfigurationSelection>().defined(),
        selectedAuthConfigId: yup.string().optional().default('')
      })
  });

  let hasVisibleInputs =
    visibility.showConfig || visibility.showAuth || visibility.showToolFilters;
  let canSubmit =
    (visibility.configRequirement !== 'required' ||
      isConfigSelectionComplete(form.values.selectedConfiguration)) &&
    (!visibility.showAuth || Boolean(form.values.selectedAuthConfigId));
  let isSaving = p.isSaving || createConfig.isLoading;

  useEffect(() => {
    // Update flows must always show the form so the user can change settings;
    // never silently submit on their behalf.
    if (p.isUpdate) return;
    if (visibility.isLoading || hasVisibleInputs || isSaving) return;
    if (
      visibility.configRequirement === 'required' &&
      !isConfigSelectionComplete(form.values.selectedConfiguration)
    )
      return;
    if (autoSubmitAttemptedRef.current) return;

    autoSubmitAttemptedRef.current = true;
    void submit(form.values);
  }, [p.isUpdate, visibility.isLoading, hasVisibleInputs, isSaving, form.values]);

  if (visibility.isLoading || isInheritedAuthMethodLoading) {
    return <CenteredSpinner />;
  }

  if (!hasVisibleInputs) {
    return (
      <Flex direction="column" gap={12}>
        <Callout color="gray">
          This provider connects automatically, nothing to set up.
        </Callout>
        {p.extraError}
      </Flex>
    );
  }

  return (
    <ProviderSetupSections
      instanceId={p.instanceId}
      providerId={providerId}
      providerDeploymentId={p.chatConnectionProvider.deployment?.id}
      fixedAuthMethodId={fixedAuthMethodId}
      fixedAuthCredentialsId={p.chatConnectionProvider.authCredentialsId ?? undefined}
      authMethodAdapter="chat"
      providerName={visibility.providerName}
      selectedConfiguration={form.values.selectedConfiguration}
      onSelectedConfigurationChange={value => {
        form.setFieldValue('selectedConfiguration', value);
        form.setFieldTouched('selectedConfiguration', false, false);
        form.setFieldError('selectedConfiguration', undefined);
      }}
      selectedAuthConfigId={form.values.selectedAuthConfigId}
      onSelectedAuthConfigIdChange={value => {
        form.setFieldValue('selectedAuthConfigId', value);
        form.setFieldTouched('selectedAuthConfigId', false, false);
        form.setFieldError('selectedAuthConfigId', undefined);
      }}
      showConfigSection={visibility.showConfig}
      forceConfigSectionVisible={p.isUpdate}
      showAuthSection={visibility.showAuth}
      showToolFilters={visibility.showToolFilters}
      configRequirement={visibility.configRequirement}
      authRequirement={visibility.showAuth ? 'required' : 'optional'}
      configError={<form.RenderError field="selectedConfiguration" />}
      authError={<form.RenderError field="selectedAuthConfigId" />}
      supplementaryContent={
        <>
          {visibility.mustRequestInstanceConfig ? (
            <Callout color="gray">
              This chat connection has no config attached. Select or create a config for this
              instance.
            </Callout>
          ) : null}
          <createConfig.RenderError />
          {p.extraError}
        </>
      }
      footer={
        <Dialog.Actions>
          <Button
            type="button"
            disabled={!canSubmit}
            loading={isSaving}
            onClick={() => {
              void form.submitForm();
            }}
          >
            {p.saveLabel}
          </Button>
        </Dialog.Actions>
      }
    />
  );
};

let ChatInstanceProviderSection = (p: {
  instanceId: string;
  chatInstance: ChatInstance;
  chatConnectionProvider: ChatConnectionProvider;
  chatInstanceProvider: ReturnType<typeof useChatInstanceProvider>;
  onComplete: () => void;
}) => {
  let setProvider = useSetChatInstanceProvider();
  let instanceProvider = p.chatInstanceProvider.data;

  return (
    <ChatInstanceProviderConfigurator
      instanceId={p.instanceId}
      chatConnectionProvider={p.chatConnectionProvider}
      instanceConfigId={instanceProvider?.config?.id ?? null}
      initialAuthConfigId={instanceProvider?.authConfig?.id ?? ''}
      isUpdate={!!instanceProvider}
      isSaving={setProvider.isPending}
      saveLabel="Save Provider"
      extraError={<setProvider.RenderError />}
      onSubmit={async ({ providerConfigId, providerAuthConfigId }) => {
        let [result] = await setProvider.mutate({
          instanceId: p.instanceId,
          chatInstanceId: p.chatInstance.id,
          providerId: p.chatConnectionProvider.provider.id,
          providerDeploymentId: p.chatConnectionProvider.deployment?.id,
          providerConfigId,
          providerAuthConfigId
        });
        if (!result) return false;

        p.chatInstanceProvider.refetch();
        p.onComplete();
        return true;
      }}
    />
  );
};

let ChatInstanceProviderConfigPanelBody = (p: {
  chatInstanceId: string;
  instanceId: string;
  close: () => void;
  onComplete?: () => void;
}) => {
  let chatInstance = useChatInstance(p.instanceId, p.chatInstanceId);
  let chatConnection = useChatConnection(p.instanceId, chatInstance.data?.chatConnectionId);
  let chatInstanceProvider = useChatInstanceProvider(p.instanceId, p.chatInstanceId);

  return renderWithLoader({ chatInstance, chatConnection })(
    ({ chatInstance, chatConnection }) => {
      let connectionProvider = chatConnection.data.providers[0];

      return (
        <>
          <Panel.Header>
            <Panel.Title>{chatInstance.data.name}</Panel.Title>
            <Panel.Description>
              Change the provider config and chat account auth used by this instance.
            </Panel.Description>
          </Panel.Header>

          <Panel.Content>
            {connectionProvider ? (
              <ChatInstanceProviderSection
                instanceId={p.instanceId}
                chatInstance={chatInstance.data}
                chatConnectionProvider={connectionProvider}
                chatInstanceProvider={chatInstanceProvider}
                onComplete={() => {
                  chatInstance.refetch();
                  p.onComplete?.();
                }}
              />
            ) : (
              <Callout color="gray">This chat connection has no provider attached.</Callout>
            )}
          </Panel.Content>
        </>
      );
    }
  );
};

export let showChatInstanceProviderConfigPanelFlow = (p: {
  instanceId: string;
  chatInstanceId: string;
  onComplete?: () => void;
}) =>
  showProviderCreationPanel(
    ({ close }) => <ChatInstanceProviderConfigPanelBody {...p} close={close} />,
    { width: 660 }
  );

let ChatInstanceCreateProviderPanelBody = (p: {
  instanceId: string;
  chatConnectionId: string;
  close: () => void;
  onComplete?: (chatInstance: { id: string }) => void;
}) => {
  let chatConnection = useChatConnection(p.instanceId, p.chatConnectionId);
  let createChatInstance = useCreateChatInstance();
  let setProvider = useSetChatInstanceProvider();

  return renderWithLoader({ chatConnection })(({ chatConnection }) => {
    let connectionProvider = chatConnection.data.providers[0];

    return (
      <>
        <Panel.Header>
          <Panel.Title>Connect Chat Account</Panel.Title>
          <Panel.Description>
            Connect the chat account this instance should act as.
          </Panel.Description>
        </Panel.Header>

        <Panel.Content>
          {connectionProvider ? (
            <ChatInstanceProviderConfigurator
              instanceId={p.instanceId}
              chatConnectionProvider={connectionProvider}
              instanceConfigId={null}
              initialAuthConfigId=""
              isUpdate={false}
              isSaving={createChatInstance.isLoading || setProvider.isPending}
              saveLabel="Create Instance"
              extraError={
                <>
                  <createChatInstance.RenderError />
                  <setProvider.RenderError />
                </>
              }
              onSubmit={async ({ providerConfigId, providerAuthConfigId }) => {
                let [created] = await createChatInstance.mutate({
                  instanceId: p.instanceId,
                  chatConnectionId: p.chatConnectionId,
                  name: generatePlaceholderInstanceName()
                });
                if (!created) return false;

                let [result] = await setProvider.mutate({
                  instanceId: p.instanceId,
                  chatInstanceId: created.id,
                  providerId: connectionProvider.provider.id,
                  providerDeploymentId: connectionProvider.deployment?.id,
                  providerConfigId,
                  providerAuthConfigId
                });
                if (!result) return false;

                p.onComplete?.(created);
                p.close();
                return true;
              }}
            />
          ) : (
            <Callout color="gray">This chat connection has no provider attached.</Callout>
          )}
        </Panel.Content>
      </>
    );
  });
};

export let showChatInstanceCreateProviderPanelFlow = (p: {
  instanceId: string;
  chatConnectionId: string;
  onComplete?: (chatInstance: { id: string }) => void;
}) =>
  showProviderCreationPanel(
    ({ close }) => <ChatInstanceCreateProviderPanelBody {...p} close={close} />,
    { width: 660 }
  );
