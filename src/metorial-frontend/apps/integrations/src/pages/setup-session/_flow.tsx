import { renderWithLoader } from '@metorial/data-hooks';
import { ElementsLayout } from '../../components/elementsLayout';
import { EmbeddedLayout } from '../../components/embeddedLayout';
import { SideLayout } from '../../components/sideLayout';
import { MobileSheetProvider } from '../../components/stepContainer';
import { useHideBootSpinner } from '../../lib/bootSpinner';
import type { Brand, Provider, Session } from '../../state/types';
import { RetryError } from './_retryError';
import { CompletedStep } from './_steps/completedStep';
import { OAuthLoadingStep, OAuthRedirectStep } from './_steps/oauthStep';
import { ProviderStep } from './_steps/providerStep';
import { SchemaFormStep } from './_steps/schemaFormStep';
import { ToolAccess } from './_steps/toolAccess';
import { useSetupFlow, type SetupFlow as SetupFlowState } from './_useSetupFlow';

let FlowStep = ({
  flow,
  completionRedirectUrl
}: {
  flow: SetupFlowState;
  completionRedirectUrl?: string | null;
}) => {
  if (flow.step === 'provider') {
    return (
      <ProviderStep
        credentials={flow.sessionCredentials}
        selectProvider={flow.selectProvider}
      />
    );
  }

  if (flow.step === 'auth_config' && flow.authConfigSchema) {
    return (
      <SchemaFormStep
        key="auth_config"
        schema={flow.authConfigSchema}
        mutation={flow.submitAuthConfig}
        submitLabel="Connect"
      />
    );
  }

  if (flow.step === 'oauth_loading') {
    return <OAuthLoadingStep error={flow.oauthError} />;
  }

  if (flow.step === 'oauth_redirect' && flow.oauthSetup) {
    return <OAuthRedirectStep oauthSetup={flow.oauthSetup} />;
  }

  if (flow.step === 'config') {
    return (
      <SchemaFormStep
        key="config"
        schema={flow.configSchema}
        mutation={flow.submitConfig}
        submitLabel={flow.needsAuthConfig ? 'Continue' : 'Connect'}
      >
        {flow.toolAccess && <ToolAccess toolAccess={flow.toolAccess} />}
      </SchemaFormStep>
    );
  }

  return <CompletedStep redirectUrl={completionRedirectUrl ?? flow.session.redirectUrl} />;
};

export let SetupFlow = ({
  session,
  brand,
  provider,
  clientSecret,
  isWhitelabel,
  completionRedirectUrl
}: {
  session: Session;
  brand: Brand;
  provider: Provider | null;
  clientSecret: string;
  isWhitelabel?: boolean;
  completionRedirectUrl?: string | null;
}) => {
  let flow = useSetupFlow({ session, provider, clientSecret });

  useHideBootSpinner(!flow.isPreparing);

  let isElementsMode = flow.session.uiMode === 'metorial_elements';
  let layout = flow.session.configuration?.ui?.layout ?? 'box';
  let isCompleted = flow.step === 'completed';
  let stageLabels = isCompleted ? [] : flow.stageLabels;

  let content = (
    <MobileSheetProvider value={isElementsMode}>
      {renderWithLoader(flow.schemaLoaders, {
        spaceTop: 48,
        spaceBottom: 48,
        error: err => <RetryError message={err.message} />
      })(() => (
        <FlowStep flow={flow} completionRedirectUrl={completionRedirectUrl} />
      ))}
    </MobileSheetProvider>
  );

  let embedded = (
    <EmbeddedLayout currentStep={flow.stageIndex} stepLabels={stageLabels}>
      {content}
    </EmbeddedLayout>
  );

  if (!isElementsMode) return embedded;

  if (layout === 'side') {
    return (
      <SideLayout
        brand={brand}
        providerName={flow.provider?.name}
        providerImageUrl={flow.provider?.imageUrl}
        isWhitelabel={isWhitelabel}
      >
        {embedded}
      </SideLayout>
    );
  }

  return (
    <ElementsLayout
      brand={brand}
      providerName={flow.provider?.name}
      providerImageUrl={flow.provider?.imageUrl}
      hideHeader={isCompleted}
      currentStep={flow.stageIndex}
      stepLabels={stageLabels}
      variant={layout === 'light' ? 'light' : 'box'}
      isWhitelabel={isWhitelabel}
    >
      {content}
    </ElementsLayout>
  );
};
