import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import {
  useCreateChatConnection,
  useCreateChatInstance,
  useCurrentInstance,
  useSetChatInstanceProvider
} from '@metorial/state';
import { useRef } from 'react';
import { AddIntegrationProviderPanel } from '../integrations/providerPanelFlow';
import { showProviderCreationPanel } from '../providerCreationPanel';
import { generatePlaceholderInstanceName } from './shared';

let chatProviderListingsFilter: DashboardInstanceProviderListingsListQuery = {
  adapter: 'chat'
};

let CreateChatConnectionPanel = (p: {
  close: () => void;
  setPanelWidth: (width: number) => void;
  onCreate?: (chatConnection: { id: string }) => void;
}) => {
  let instance = useCurrentInstance();
  let createChatConnection = useCreateChatConnection();
  let createChatInstance = useCreateChatInstance();
  let setChatInstanceProvider = useSetChatInstanceProvider();
  let createdRef = useRef<{ id: string } | null>(null);

  return (
    <AddIntegrationProviderPanel
      close={p.close}
      setPanelWidth={p.setPanelWidth}
      title="Create Chat Connection"
      description="Pick a chat provider and connect it to Metorial."
      submitLabel="Create Connection"
      providerListingsFilter={chatProviderListingsFilter}
      providerSelectionEmptyText="No chat providers are available yet."
      authMethodAdapter="chat"
      hideCallbacks
      hideToolFilters
      showAuthConfigModeToggle
      requireAuthConfigModeSelection
      animateAuthConfigSection
      reuseAuthConfigDeployment
      authConfigModeCopy={{
        title: 'Mode',
        description:
          'Choose whether this connection serves multiple chat users or one authenticated account.',
        notProvided: {
          name: 'Multi-User',
          description: 'Let each chat user connect and authenticate their own account.'
        },
        provided: {
          name: 'Single-User',
          description: 'Use one auth config and create the first connected instance now.'
        }
      }}
      externalIsSaving={
        createChatConnection.isLoading ||
        createChatInstance.isLoading ||
        setChatInstanceProvider.isPending
      }
      submissionErrors={
        <>
          <createChatConnection.RenderError />
          <createChatInstance.RenderError />
          <setChatInstanceProvider.RenderError />
        </>
      }
      onSubmitProvider={async input => {
        if (!instance.data) return { success: false };

        let [chatConnection] = await createChatConnection.mutate({
          instanceId: instance.data.id,
          name: input.providerName?.trim() || 'Chat Connection',
          provider: {
            providerId: input.providerId,
            providerDeploymentId: input.providerDeploymentId,
            providerConfigId: input.providerConfigId ?? null,
            providerAuthMethodId: input.providerAuthMethodId ?? null,
            providerAuthCredentialsId: input.providerAuthCredentialsId ?? null
          }
        });
        if (!chatConnection) return { success: false, error: createChatConnection.error };

        if (input.authConfigMode === 'provided') {
          if (!input.providerAuthConfigId) return { success: false };

          let [chatInstance] = await createChatInstance.mutate({
            instanceId: instance.data.id,
            chatConnectionId: chatConnection.id,
            name: generatePlaceholderInstanceName()
          });
          if (!chatInstance) return { success: false, error: createChatInstance.error };

          let [chatInstanceProvider] = await setChatInstanceProvider.mutate({
            instanceId: instance.data.id,
            chatInstanceId: chatInstance.id,
            providerId: input.providerId,
            providerDeploymentId: input.providerDeploymentId,
            providerConfigId: input.providerConfigId ?? undefined,
            providerAuthConfigId: input.providerAuthConfigId
          });
          if (!chatInstanceProvider) {
            return { success: false, error: setChatInstanceProvider.error };
          }
        }

        createdRef.current = chatConnection;
        return { success: true };
      }}
      onComplete={() => {
        if (createdRef.current) p.onCreate?.(createdRef.current);
      }}
    />
  );
};

export let showCreateChatConnectionFlow = (p: {
  onCreate?: (chatConnection: { id: string }) => void;
}) =>
  showProviderCreationPanel(({ close, setWidth }) => (
    <CreateChatConnectionPanel close={close} setPanelWidth={setWidth} onCreate={p.onCreate} />
  ));
