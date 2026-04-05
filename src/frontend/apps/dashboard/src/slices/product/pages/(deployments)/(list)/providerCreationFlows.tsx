import { Button, Dialog, Panel, showModal, Spacer } from '@metorial/ui';
import { type ReactNode } from 'react';
import { showProviderAuthConfigMethodPickerModal } from '../../../scenes/providerAuthConfigs/modal';
import { showProviderAuthConfigPanelFlow } from '../../../scenes/providerAuthConfigs/panelFlow';
import { showProviderAuthCredentialsPanelFlow } from '../../../scenes/providerAuthCredentials/panelFlow';
import { showProviderConfigVaultPanelFlow } from '../../../scenes/providerConfigVaults/panelFlow';
import { showProviderConfigPanelFlow } from '../../../scenes/providerConfigs/panelFlow';
import { ProviderDeploymentsList } from '../../../scenes/providerDeployments/list';
import { ProvidersWithDeploymentsSearch } from '../../../scenes/providers/search';

let DIALOG_EXIT_MS = 220;

let closeAndThen = (close: () => void, next?: () => void) => {
  close();
  if (!next) return;
  setTimeout(() => next(), DIALOG_EXIT_MS);
};

let PickerDialogScaffold = ({
  title,
  description,
  close,
  onBack,
  layout = 'dialog',
  children
}: {
  title: string;
  description: string;
  close: () => void;
  onBack?: () => void;
  layout?: 'dialog' | 'side';
  children: ReactNode;
}) => {
  let hasFooterActions = !!onBack;

  if (layout === 'side') {
    return (
      <>
        <Panel.Header>
          <Panel.Title>{title}</Panel.Title>
          <Panel.Description>{description}</Panel.Description>
        </Panel.Header>

        <Panel.Content>
          {children}

          {hasFooterActions && (
            <>
              <Spacer size={10} />

              <Panel.Actions>
                <Button
                  size="2"
                  variant="outline"
                  onClick={() => {
                    closeAndThen(close, onBack);
                  }}
                >
                  Back
                </Button>
              </Panel.Actions>
            </>
          )}
        </Panel.Content>
      </>
    );
  }

  return (
    <>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>

      <Spacer size={10} />

      {children}

      {hasFooterActions && (
        <>
          <Spacer size={10} />

          <Dialog.Actions>
            <Button
              size="2"
              variant="outline"
              onClick={() => {
                closeAndThen(close, onBack);
              }}
            >
              Back
            </Button>
          </Dialog.Actions>
        </>
      )}
    </>
  );
};

let DeploymentPicker = ({
  title,
  description,
  close,
  onSelect,
  onBack,
  providerId,
  selectionMode = 'default',
  layout = 'dialog'
}: {
  title: string;
  description: string;
  close: () => void;
  onSelect: (deploymentId: string) => void;
  onBack?: () => void;
  providerId?: string;
  selectionMode?:
    | 'default'
    | 'configCreate'
    | 'configVaultCreate'
    | 'authConfigCreate'
    | 'authCredentialsCreate';
  layout?: 'dialog' | 'side';
}) => {
  return (
    <PickerDialogScaffold
      title={title}
      description={description}
      close={close}
      onBack={onBack}
      layout={layout}
    >
      <ProviderDeploymentsList
        providerId={providerId}
        selectionMode={selectionMode}
        searchable
        compact
        columns={3}
        limit={18}
        sectionLabel="Deployments"
        emptyText={
          providerId
            ? 'No deployments found for this provider.'
            : 'No deployments found. Create a deployment first.'
        }
        onDeploymentClick={deployment => {
          closeAndThen(close, () => onSelect(deployment.id));
        }}
      />
    </PickerDialogScaffold>
  );
};

let ProviderPicker = ({
  instanceId,
  title,
  description,
  close,
  onSelect,
  selectionMode = 'default',
  layout = 'dialog',
  limit = 18
}: {
  instanceId: string;
  title: string;
  description: string;
  close: () => void;
  onSelect: (providerId: string) => void;
  selectionMode?: 'default' | 'authCredentialsCreate';
  layout?: 'dialog' | 'side';
  limit?: number;
}) => {
  return (
    <PickerDialogScaffold
      title={title}
      description={description}
      close={close}
      layout={layout}
    >
      <ProvidersWithDeploymentsSearch
        instanceId={instanceId}
        columns={3}
        limit={limit}
        selectionMode={selectionMode}
        variant="providerCard"
        cardSize="compact"
        includeAllProviders
        prioritizeProvidersWithDeployments
        emptyText="No providers found."
        onSelect={provider => {
          closeAndThen(close, () => onSelect(provider.id));
        }}
      />
    </PickerDialogScaffold>
  );
};

let showPickerModal = (
  children: (d: { close: () => void }) => ReactNode,
  opts?: { layout?: 'dialog' | 'side'; sideWidth?: number }
) =>
  showModal(({ dialogProps, close }) =>
    opts?.layout === 'side' ? (
      <Panel.Wrapper {...dialogProps} width={opts.sideWidth ?? 1000}>
        {children({ close })}
      </Panel.Wrapper>
    ) : (
      <Dialog.Wrapper {...dialogProps} width={550}>
        {children({ close })}
      </Dialog.Wrapper>
    )
  );

export let showCreateProviderConfigFlow = (instanceId: string) => {
  return showProviderConfigPanelFlow({ instanceId });
};

export let showCreateProviderConfigVaultFlow = (instanceId: string) => {
  return showProviderConfigVaultPanelFlow({ instanceId });
};

export let showCreateProviderAuthCredentialsFlow = (instanceId: string) => {
  return showProviderAuthCredentialsPanelFlow({ instanceId });
};

export let showCreateProviderAuthConfigFlow = (
  instanceId: string,
  options?: {
    onCreated?: (deploymentId: string | null, authConfigId: string) => void;
    scope?: 'provider' | 'deployment';
  }
) => {
  let scope = options?.scope ?? 'provider';
  if (scope === 'provider') {
    return showProviderAuthConfigPanelFlow({
      instanceId
    });
  }

  let authConfigPickerModalOpts = { layout: 'side' as const, sideWidth: 1000 };
  let showDeploymentStep = (providerId: string) =>
    showPickerModal(
      ({ close }) => (
        <DeploymentPicker
          title="Select Deployment"
          description="Choose a deployment to attach this auth configuration to."
          close={close}
          selectionMode="authConfigCreate"
          providerId={providerId}
          layout="side"
          onBack={() => showCreateProviderAuthConfigFlow(instanceId, options)}
          onSelect={deploymentId =>
            showProviderAuthConfigMethodPickerModal({
              instanceId,
              providerDeploymentId: deploymentId,
              onBack: () => showDeploymentStep(providerId),
              onCreate: authConfig => {
                options?.onCreated?.(deploymentId, authConfig.id);
              }
            })
          }
        />
      ),
      authConfigPickerModalOpts
    );

  return showPickerModal(
    ({ close }) => (
      <ProviderPicker
        instanceId={instanceId}
        title="Create Auth Config"
        description="Select a provider to create an authentication configuration for."
        close={close}
        layout="side"
        limit={30}
        onSelect={providerId => {
          showDeploymentStep(providerId);
        }}
      />
    ),
    authConfigPickerModalOpts
  );
};
