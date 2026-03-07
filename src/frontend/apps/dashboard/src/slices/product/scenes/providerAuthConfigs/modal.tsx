import {
  DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput,
  DashboardInstanceProvidersAuthMethodsListOutput
} from '@metorial/dashboard-sdk';
import { useProviderDeployment } from '@metorial/state';
import {
  Button,
  CenteredSpinner,
  Dialog,
  Select,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { useState } from 'react';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { ProviderSetupSessionEmbed } from '../providerDeployments/setupSessionEmbed';
import { Stepper } from '../stepper';
import { ProviderAuthConfigForm, ProviderAuthConfigFormProps } from './form';

type AuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];

let getAuthMethodHasSchema = (method: AuthMethod | undefined) => {
  let schema = method?.inputSchema?.schema;
  return !!(
    schema &&
    typeof schema === 'object' &&
    'type' in schema &&
    schema.type === 'object' &&
    'properties' in schema &&
    schema.properties &&
    typeof schema.properties === 'object' &&
    Object.keys(schema.properties).length > 0
  );
};

let isSetupFlowAuthMethod = (method: AuthMethod | undefined) =>
  method?.type === 'oauth' && !getAuthMethodHasSchema(method);

let getAuthMethodSelectionSteps = (p: {
  method: AuthMethod | undefined;
  oauthAutoRegistrationEnabled: boolean;
}) => {
  if (isSetupFlowAuthMethod(p.method)) {
    return p.oauthAutoRegistrationEnabled
      ? [
          { title: 'Authentication', subtitle: 'Select auth method', render: () => null },
          { title: 'Connect', subtitle: 'Complete authentication', render: () => null }
        ]
      : [
          { title: 'Authentication', subtitle: 'Select auth method', render: () => null },
          { title: 'Credentials', subtitle: 'Provide credential values', render: () => null },
          { title: 'Connect', subtitle: 'Complete authentication', render: () => null }
        ];
  }

  return [
    { title: 'Authentication', subtitle: 'Select auth method', render: () => null },
    { title: 'Credentials', subtitle: 'Provide credential values', render: () => null },
    { title: 'Details', subtitle: 'Name and create', render: () => null }
  ];
};

export let showProviderAuthConfigFormModal = (
  p: ProviderAuthConfigFormProps & {
    onCreate?: (authConfig: DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput) => void;
    onBack?: () => void;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>
        {p.type == 'update' ? 'Update Auth Config' : 'Create Auth Config'}
      </Dialog.Title>

      <Dialog.Description>
        {p.type == 'update'
          ? 'Update the auth config details.'
          : 'Create a new authentication configuration for the selected provider.'}
      </Dialog.Description>

      <ProviderAuthConfigForm
        {...p}
        close={close}
        onCreate={p.onCreate}
        onBack={() => {
          close();
          p.onBack?.();
        }}
      />
    </Dialog.Wrapper>
  ));

let ProviderAuthConfigCreateModalContent = (p: {
  instanceId: string;
  providerDeploymentId: string;
  close: () => void;
  onCreate?: (authConfig: { id: string }) => void;
  onBack?: () => void;
}) => {
  let deployment = useProviderDeployment(p.instanceId, p.providerDeploymentId);
  let authCreation = useProviderAuthCreationCapabilities(
    p.instanceId,
    p.providerDeploymentId,
    deployment.data?.providerId
  );
  let providerName =
    authCreation.provider.data?.name ?? deployment.data?.name ?? 'provider';
  let providerId = deployment.data?.providerId ?? authCreation.provider.data?.id;
  let authMethods = authCreation.authMethodItems;
  let manualMethods = authMethods.filter(method => !isSetupFlowAuthMethod(method));
  let setupFlowMethods = authMethods.filter(method => isSetupFlowAuthMethod(method));
  let [draftMethodId, setDraftMethodId] = useState('');
  let [activeMethodId, setActiveMethodId] = useState('');
  let activeMethod = authMethods.find(method => method.id === activeMethodId);
  let draftMethod = authMethods.find(method => method.id === draftMethodId);
  let oauthAutoRegistrationEnabled =
    authCreation.provider.data?.oauth?.autoRegistration?.status === 'enabled';

  if (authCreation.isLoading) {
    return <CenteredSpinner />;
  }

  if (!authCreation.canCreateAuthConfig) {
    return (
      <>
        <Dialog.Title>Create Auth Config</Dialog.Title>
        <Dialog.Description>
          {authCreation.authConfigDisabledReason ??
            'This deployment cannot create an auth config from the dashboard.'}
        </Dialog.Description>

        <Spacer size={15} />

        <Dialog.Actions>
          <Button variant="outline" onClick={p.onBack ?? p.close}>
            Back
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  if (!manualMethods.length && setupFlowMethods.length) {
    if (!providerId) {
      return (
        <>
          <Dialog.Title>Create Auth Config</Dialog.Title>
          <Dialog.Description>
            Could not resolve the provider for this deployment.
          </Dialog.Description>

          <Spacer size={15} />

          <Dialog.Actions>
            <Button variant="outline" onClick={p.onBack ?? p.close}>
              Back
            </Button>
          </Dialog.Actions>
        </>
      );
    }

    return (
      <>
        <Dialog.Title>Configure {providerName} Authentication</Dialog.Title>
        <Dialog.Description>
          Complete the {providerName} authentication flow to create an auth config
          for this deployment.
        </Dialog.Description>

        <ProviderSetupSessionEmbed
          instanceId={p.instanceId}
          providerId={providerId}
          deploymentId={p.providerDeploymentId}
          hideMethodStep={false}
          onComplete={result => {
            let authConfigId = result?.authConfig?.id;
            if (authConfigId) {
              p.onCreate?.({ id: authConfigId });
            }
            p.close();
          }}
          onCancel={p.close}
        />
      </>
    );
  }

  if (manualMethods.length && setupFlowMethods.length) {
    if (activeMethod && isSetupFlowAuthMethod(activeMethod)) {
      if (!providerId) {
        return (
          <>
            <Dialog.Title>Create Auth Config</Dialog.Title>
            <Dialog.Description>
              Could not resolve the provider for this deployment.
            </Dialog.Description>

            <Spacer size={15} />

            <Dialog.Actions>
              <Button variant="outline" onClick={() => setActiveMethodId('')}>
                Back
              </Button>
            </Dialog.Actions>
          </>
        );
      }

      return (
        <>
          <Dialog.Title>Configure {providerName} Authentication</Dialog.Title>
          <Dialog.Description>
            Complete the {activeMethod.name} flow to create an auth config for this deployment.
          </Dialog.Description>

          <ProviderSetupSessionEmbed
            instanceId={p.instanceId}
            providerId={providerId}
            deploymentId={p.providerDeploymentId}
            initialMethodId={activeMethod.id}
            hideMethodStep
            showMethodStepInStepper
            onBackToMethodSelection={() => setActiveMethodId('')}
            onComplete={result => {
              let authConfigId = result?.authConfig?.id;
              if (authConfigId) {
                p.onCreate?.({ id: authConfigId });
              }
              p.close();
            }}
            onCancel={p.close}
          />
        </>
      );
    }

    if (activeMethod) {
      return (
        <>
          <Dialog.Title>Create Auth Config</Dialog.Title>
          <Dialog.Description>
            Create a new authentication configuration for the selected provider.
          </Dialog.Description>

          <ProviderAuthConfigForm
            type="create"
            instanceId={p.instanceId}
            providerDeploymentId={p.providerDeploymentId}
            initialAuthMethodId={activeMethod.id}
            hideAuthMethodStep
            showAuthMethodStepInStepper
            close={p.close}
            onBack={() => setActiveMethodId('')}
            onCreate={authConfig => {
              p.onCreate?.({ id: authConfig.id });
            }}
          />
        </>
      );
    }

    return (
      <>
        <Dialog.Title>Create Auth Config</Dialog.Title>
        <Dialog.Description>
          Choose an authentication method for this deployment.
        </Dialog.Description>

        <Stepper
          steps={[
            {
              ...getAuthMethodSelectionSteps({
                method: draftMethod,
                oauthAutoRegistrationEnabled
              })[0],
              render: () => (
                <>
                  <Select
                    label="Authentication Method"
                    value={draftMethodId}
                    placeholder="Select an authentication method..."
                    onChange={setDraftMethodId}
                    items={authMethods.map(method => ({
                      id: method.id,
                      label: method.name
                    }))}
                  />

                  <Spacer size={10} />

                  <Dialog.Actions>
                    <Button variant="outline" onClick={p.close}>
                      Cancel
                    </Button>
                    <Button onClick={() => setActiveMethodId(draftMethodId)} disabled={!draftMethodId}>
                      Continue
                    </Button>
                  </Dialog.Actions>
                </>
              )
            },
            ...getAuthMethodSelectionSteps({
              method: draftMethod,
              oauthAutoRegistrationEnabled
            }).slice(1)
          ]}
          currentStep={0}
          setCurrentStep={() => {}}
        />
      </>
    );
  }

  return (
    <>
      <Dialog.Title>Create Auth Config</Dialog.Title>
      <Dialog.Description>
        Create a new authentication configuration for the selected provider.
      </Dialog.Description>

      <ProviderAuthConfigForm
        type="create"
        instanceId={p.instanceId}
        providerDeploymentId={p.providerDeploymentId}
        close={p.close}
        onBack={() => {
          p.close();
          p.onBack?.();
        }}
        onCreate={authConfig => {
          p.onCreate?.({ id: authConfig.id });
        }}
      />
    </>
  );
};

export let showProviderAuthConfigCreateModal = (p: {
  instanceId: string;
  providerDeploymentId: string;
  onCreate?: (authConfig: { id: string }) => void;
  onBack?: () => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={700}>
      <ProviderAuthConfigCreateModalContent
        {...p}
        close={close}
        onCreate={p.onCreate}
        onBack={p.onBack}
      />
    </Dialog.Wrapper>
  ));
