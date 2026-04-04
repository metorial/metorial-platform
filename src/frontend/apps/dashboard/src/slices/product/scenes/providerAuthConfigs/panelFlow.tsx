import { useForm } from '@metorial/data-hooks';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { ProvidersWithDeploymentsSearch } from '../providers/search';
import { PillStepper } from '../stepper';
import { AuthMethodPicker } from './authMethodPicker';
import { ProviderAuthConfigCreateFlowContent } from './createModal';
import { getCreateMethodDescription } from './modalHelpers';
import { showPickerSidePanel } from './pickerPanel';
import { Button, CenteredSpinner, Dialog, Panel, Spacer, Text } from '@metorial/ui';
import { useEffect, useMemo, useState } from 'react';

type PanelFlowProps = {
  instanceId: string;
  onCreated?: (deploymentId: string | null, authConfigId: string) => void;
};

let AuthMethodStep = (p: {
  instanceId: string;
  providerId: string;
  selectedMethodId: string;
  autoSkipSingle: boolean;
  setAutoSkipSingle: (value: boolean) => void;
  setSelectedMethodId: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) => {
  let authCreation = useProviderAuthCreationCapabilities(
    p.instanceId,
    undefined,
    p.providerId
  );
  let methods = authCreation.authMethodItems;
  let providerName = authCreation.provider.data?.name ?? 'this provider';
  let form = useForm({
    initialValues: {
      authMethodId: p.selectedMethodId || ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      form.setFieldTouched('authMethodId', true, false);
      await form.validateField('authMethodId');

      if (!values.authMethodId) return;

      p.setSelectedMethodId(values.authMethodId);
      p.setAutoSkipSingle(false);
      p.onContinue();
    },
    schema: yup =>
      yup.object({
        authMethodId: yup.string().required('Authentication method is required')
      })
  });
  let effectiveSelectedMethodId =
    form.values.authMethodId || (methods.length === 1 ? methods[0]!.id : '');

  useEffect(() => {
    if (!p.autoSkipSingle) return;
    if (authCreation.isLoading || !authCreation.canCreateAuthConfig) return;
    if (methods.length !== 1) return;

    form.setFieldValue('authMethodId', methods[0]!.id);
    p.setSelectedMethodId(methods[0]!.id);
    p.setAutoSkipSingle(false);
    p.onContinue();
  }, [
    p.autoSkipSingle,
    authCreation.isLoading,
    authCreation.canCreateAuthConfig,
    methods,
    p.onContinue,
    p.setAutoSkipSingle,
    p.setSelectedMethodId,
    form.setFieldValue
  ]);

  useEffect(() => {
    if (p.autoSkipSingle) return;
    if (authCreation.isLoading || !authCreation.canCreateAuthConfig) return;
    if (form.values.authMethodId) return;

    let firstMethodId = methods[0]?.id;
    if (!firstMethodId) return;

    form.setFieldValue('authMethodId', firstMethodId);
    p.setSelectedMethodId(firstMethodId);
  }, [
    p.autoSkipSingle,
    authCreation.isLoading,
    authCreation.canCreateAuthConfig,
    methods,
    form.values.authMethodId,
    form.setFieldValue,
    p.setSelectedMethodId
  ]);

  if (authCreation.isLoading) {
    return <CenteredSpinner />;
  }

  if (!authCreation.canCreateAuthConfig) {
    return (
      <>
        <Text size="2" color="gray600">
          {authCreation.authConfigDisabledReason ??
            'Authentication cannot be configured for this provider right now.'}
        </Text>
        <Spacer size={15} />
        <Dialog.Actions>
          <Button variant="outline" onClick={p.onBack}>
            Back
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  if (methods.length === 0) {
    return (
      <>
        <Text size="2" color="gray600">
          No authentication methods are available for {providerName}.
        </Text>
        <Spacer size={15} />
        <Dialog.Actions>
          <Button variant="outline" onClick={p.onBack}>
            Back
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  return (
    <form onSubmit={form.handleSubmit}>
      <AuthMethodPicker
        name="provider-auth-method"
        label="Authentication method"
        hideLabel
        focusOnMount
        value={effectiveSelectedMethodId}
        onChange={value => {
          form.setFieldValue('authMethodId', value);
          p.setSelectedMethodId(value);
        }}
        items={methods.map(method => ({
          id: method.id,
          name: method.name,
          description: method.description?.trim() || getCreateMethodDescription(method)
        }))}
      />

      <form.RenderError field="authMethodId" />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.onBack}>
          Back
        </Button>
        <Button
          type="submit"
          color="black"
          variant="solid"
          disabled={!effectiveSelectedMethodId}
        >
          Continue
        </Button>
      </Dialog.Actions>
    </form>
  );
};

let ProviderAuthConfigPanelFlow = (p: PanelFlowProps & { close: () => void }) => {
  let [step, setStep] = useState(0);
  let [providerId, setProviderId] = useState<string | null>(null);
  let [selectedMethodId, setSelectedMethodId] = useState('');
  let [autoSkipSingle, setAutoSkipSingle] = useState(false);

  let steps = useMemo(
    () => [
      {
        title: 'Select Provider',
        render: () => (
          <ProvidersWithDeploymentsSearch
            instanceId={p.instanceId}
            columns={3}
            limit={30}
            variant="providerCard"
            cardSize="compact"
            includeAllProviders
            prioritizeProvidersWithDeployments
            internalScroll
            internalScrollHeight="calc(100vh - 260px)"
            emptyText="No providers found."
            onSelect={provider => {
              setProviderId(provider.id);
              setSelectedMethodId('');
              setAutoSkipSingle(true);
              setStep(1);
            }}
          />
        )
      },
      {
        title: 'Select Auth Method',
        render: () =>
          providerId ? (
            <AuthMethodStep
              instanceId={p.instanceId}
              providerId={providerId}
              selectedMethodId={selectedMethodId}
              autoSkipSingle={autoSkipSingle}
              setAutoSkipSingle={setAutoSkipSingle}
              setSelectedMethodId={setSelectedMethodId}
              onBack={() => {
                setStep(0);
              }}
              onContinue={() => {
                setStep(2);
              }}
            />
          ) : (
            <CenteredSpinner />
          )
      },
      {
        title: 'Authenticate',
        render: () =>
          providerId && selectedMethodId ? (
            <ProviderAuthConfigCreateFlowContent
              instanceId={p.instanceId}
              providerId={providerId}
              initialAuthMethodId={selectedMethodId}
              close={p.close}
              embedded
              onBack={() => {
                setStep(1);
              }}
              onCreate={authConfig => {
                p.onCreated?.(null, authConfig.id);
              }}
            />
          ) : (
            <CenteredSpinner />
          )
      }
    ],
    [p.instanceId, p.onCreated, p.close, providerId, selectedMethodId, autoSkipSingle]
  );

  return (
    <>
      <Panel.Header>
        <Panel.Title>Create Auth Config</Panel.Title>
        <Panel.Description>
          Select a provider, choose an auth method, then authenticate.
        </Panel.Description>
      </Panel.Header>
      <Panel.Content>
        <PillStepper
          steps={steps}
          currentStep={step}
          setCurrentStep={nextStep => {
            if (nextStep === 0) {
              setStep(0);
              return;
            }
            if (nextStep === 1 && providerId) {
              setStep(1);
              setAutoSkipSingle(false);
              return;
            }
            if (nextStep === 2 && providerId && selectedMethodId) {
              setStep(2);
            }
          }}
        />
      </Panel.Content>
    </>
  );
};

export let showProviderAuthConfigPanelFlow = (p: PanelFlowProps) =>
  showPickerSidePanel(({ close }) => <ProviderAuthConfigPanelFlow {...p} close={close} />);
