import {
  Avatar,
  Badge,
  Button,
  Copy,
  Flex,
  Input,
  InputLabel,
  Select,
  Spacer,
  Text
} from '@metorial/ui';
import type { ReactNode } from 'react';
import { AuthMethodPicker } from '../../providerAuthConfigs/authMethodPicker';
import {
  FlatConnectForm,
  FlatConnectSection,
  ManagedCredentialsColumn,
  ManagedCredentialsLayout,
  ManagedCredentialsMetaRow,
  ManagedCredentialsPreview,
  ManagedCredentialsPreviewAction,
  ManagedCredentialsPreviewBrand,
  ManagedCredentialsPreviewBrandImage,
  ManagedCredentialsPreviewCard,
  ManagedCredentialsPreviewConnection,
  ManagedCredentialsPreviewConnector,
  ManagedCredentialsPreviewFrame,
  ManagedCredentialsPreviewHeader,
  ManagedCredentialsPreviewTop,
  SummaryField,
  SummaryFieldMeta,
  SummaryFieldValue
} from './styled';
import type { SetupSessionState } from './types';

type AnyForm = any;

type CredentialSelectItem =
  | { type: 'separator' }
  | { id: string; label: string; disabled?: boolean };

export type SetupStep = {
  title: string;
  subtitle?: string;
  render: () => ReactNode;
};

export let SetupStateMessage = (p: {
  message: string;
  messageColor?: 'gray600' | 'red500' | 'red600';
  cancelLabel: string;
  onCancel?: () => void;
  onClose: () => void;
  closeLabel?: string;
}) => {
  return (
    <Flex direction="column" gap={12}>
      <Text size="2" color={p.messageColor ?? 'gray600'}>
        {p.message}
      </Text>
      <Flex gap={10}>
        {p.onCancel && (
          <Button variant="outline" onClick={p.onCancel}>
            {p.cancelLabel}
          </Button>
        )}
        <Button onClick={p.onClose}>{p.closeLabel ?? 'Close'}</Button>
      </Flex>
    </Flex>
  );
};

export let MissingSetupWindowState = (p: {
  cancelLabel: string;
  onCancel?: () => void;
  onChangeMethod: () => void;
}) => {
  return (
    <Flex direction="column" gap={12}>
      <Text size="2" color="red600">
        Setup session did not return a URL. Please try again.
      </Text>
      <Flex gap={10}>
        <Button variant="outline" onClick={p.onChangeMethod}>
          Change Method
        </Button>
        {p.onCancel && (
          <Button variant="outline" onClick={p.onCancel}>
            {p.cancelLabel}
          </Button>
        )}
      </Flex>
    </Flex>
  );
};

export let AuthConfigDetailsFields = (p: {
  collectAuthConfigDetails: boolean;
  authConfigDetailsForm: AnyForm;
  disabled?: boolean;
}) => {
  if (!p.collectAuthConfigDetails) return null;

  return (
    <>
      <Input
        label="Auth Config Name"
        description="Name the connection so you can tell it apart from other auth configs."
        {...p.authConfigDetailsForm.getFieldProps('name')}
        placeholder="e.g. John Doe"
        disabled={p.disabled}
      />
      <p.authConfigDetailsForm.RenderError field="name" />

      <Spacer size={10} />

      <Input
        label="Auth Config Description"
        description="Optional context for your team about what this connection is used for."
        placeholder="e.g. Production workspace for the CRM sync"
        {...p.authConfigDetailsForm.getFieldProps('description')}
        disabled={p.disabled}
      />
      <p.authConfigDetailsForm.RenderError field="description" />
    </>
  );
};

let RedirectUriField = (p: { redirectUri: string }) => {
  return (
    <>
      <Spacer size={12} />
      <Text size="1" weight="medium" color="gray900">
        Redirect URI
      </Text>
      <Text size="1" color="gray600" style={{ marginBottom: 5 }}>
        You must configure this redirect URI in your OAuth app.
      </Text>
      <Copy value={p.redirectUri} />
    </>
  );
};

let NewCredentialsFields = (p: { credentialsForm: AnyForm; disabled?: boolean }) => {
  return (
    <>
      <Spacer size={12} />

      <Input
        label="Name"
        value={p.credentialsForm.values.newCredName}
        disabled={p.disabled}
        onChange={e => p.credentialsForm.setFieldValue('newCredName', e.target.value)}
        placeholder="My OAuth App"
      />
      <p.credentialsForm.RenderError field="newCredName" />

      <Spacer size={8} />

      <Input
        label="Client ID"
        value={p.credentialsForm.values.newCredClientId}
        disabled={p.disabled}
        onChange={e => p.credentialsForm.setFieldValue('newCredClientId', e.target.value)}
        placeholder="Enter client ID from provider"
      />
      <p.credentialsForm.RenderError field="newCredClientId" />

      <Spacer size={8} />

      <Input
        label="Client Secret"
        value={p.credentialsForm.values.newCredClientSecret}
        disabled={p.disabled}
        onChange={e => p.credentialsForm.setFieldValue('newCredClientSecret', e.target.value)}
        placeholder="Enter client secret from provider"
        type="password"
      />
      <p.credentialsForm.RenderError field="newCredClientSecret" />
    </>
  );
};

let CredentialsSelector = (p: {
  credentialsForm: AnyForm;
  selectedCredentialId: string;
  credentialSelectItems: CredentialSelectItem[];
  handleCredentialSelectionChange: (value: string) => void;
  hasManagedVisibleCredentials: boolean;
  isCreatingCredentials: boolean;
  redirectUri?: string;
  isCustomSelected: boolean;
  disableCredentialSelection?: boolean;
  disabled?: boolean;
}) => {
  let shouldShowRedirectUri =
    !!p.redirectUri &&
    p.isCustomSelected &&
    (p.isCreatingCredentials || !!p.selectedCredentialId);

  return (
    <>
      <Select
        label="Credentials"
        description={
          p.disableCredentialSelection
            ? 'Credentials are fixed by the integration provider for this auth config.'
            : 'Select existing credentials or add new ones for this provider.'
        }
        value={
          p.credentialsForm.values.credentialMode === 'new'
            ? '__create_new__'
            : p.selectedCredentialId
        }
        placeholder="Select or add credentials"
        disabled={p.disabled || p.disableCredentialSelection}
        onChange={p.handleCredentialSelectionChange}
        items={p.credentialSelectItems}
      />
      <p.credentialsForm.RenderError field="selectedCredentialId" />

      {p.hasManagedVisibleCredentials && !p.disableCredentialSelection && (
        <>
          <Spacer size={5} />
          <Text size="1" color="gray600">
            Metorial Managed credentials are available for quick testing, or choose Add
            credentials to use your own OAuth app.
          </Text>
        </>
      )}

      {shouldShowRedirectUri && p.redirectUri && (
        <RedirectUriField redirectUri={p.redirectUri} />
      )}

      {p.isCreatingCredentials && !p.disableCredentialSelection && (
        <NewCredentialsFields credentialsForm={p.credentialsForm} disabled={p.disabled} />
      )}
    </>
  );
};

let ManagedCredentialsPreviewPanel = (p: {
  projectBrandImageUrl?: string | null;
  projectBrandName: string;
  providerName: string;
  providerImageUrl?: string | null;
  hasManagedVisibleCredentials: boolean;
  isManagedSelected: boolean;
}) => {
  return (
    <ManagedCredentialsPreview>
      <ManagedCredentialsPreviewFrame>
        <ManagedCredentialsPreviewTop>
          <Text size="2" weight="strong">
            Preview
          </Text>
          <Text size="1" color="gray600">
            OAuth connection preview
          </Text>
        </ManagedCredentialsPreviewTop>

        <ManagedCredentialsPreviewCard>
          <ManagedCredentialsPreviewHeader>
            <ManagedCredentialsPreviewBrand>
              {p.projectBrandImageUrl ? (
                <ManagedCredentialsPreviewBrandImage
                  src={p.projectBrandImageUrl}
                  alt={p.projectBrandName}
                />
              ) : (
                <Avatar entity={{ name: p.projectBrandName }} size={28} radius={8} noTooltip />
              )}
            </ManagedCredentialsPreviewBrand>

            <div style={{ minWidth: 0 }}>
              <Text size="2" weight="strong">
                {p.projectBrandName}
              </Text>
              <Text size="1" color="gray600">
                Continue with {p.providerName}
              </Text>
            </div>
          </ManagedCredentialsPreviewHeader>

          <ManagedCredentialsPreviewConnection>
            <Avatar
              entity={{
                name: p.projectBrandName,
                imageUrl: p.projectBrandImageUrl
              }}
              size={44}
              radius={10}
              noTooltip
              imageFit="contain"
            />
            <ManagedCredentialsPreviewConnector />
            <Avatar
              entity={{
                name: p.providerName,
                imageUrl: p.providerImageUrl
              }}
              size={44}
              radius={10}
              noTooltip
              imageFit="contain"
            />
          </ManagedCredentialsPreviewConnection>

          <ManagedCredentialsPreviewAction>
            Connect {p.providerName}
          </ManagedCredentialsPreviewAction>
        </ManagedCredentialsPreviewCard>

        <ManagedCredentialsMetaRow>
          {p.isManagedSelected ? (
            <>
              <Badge color="gray">Managed</Badge>
              <Badge color="gray">Read-only</Badge>
            </>
          ) : p.hasManagedVisibleCredentials ? (
            <Badge color="blue">Custom</Badge>
          ) : (
            <Badge color="blue">Your credentials</Badge>
          )}
        </ManagedCredentialsMetaRow>
      </ManagedCredentialsPreviewFrame>
    </ManagedCredentialsPreview>
  );
};

export let ConnectSummary = (p: {
  hasCredentialsStep: boolean;
  selectedCredentialLabel: string;
  isManagedSelected: boolean;
  isSelectedCredentialDefault: boolean;
  collectAuthConfigDetails: boolean;
  authConfigDetailsForm: AnyForm;
  disabled?: boolean;
}) => {
  return (
    <>
      {p.hasCredentialsStep && (
        <>
          <SummaryField>
            <InputLabel>Credentials</InputLabel>
            <SummaryFieldValue>
              <div style={{ minWidth: 0 }}>
                <Text size="2" weight="medium">
                  {p.selectedCredentialLabel}
                </Text>
              </div>

              <SummaryFieldMeta>
                {p.isManagedSelected && <Badge color="gray">Managed</Badge>}
                {p.isSelectedCredentialDefault && <Badge color="blue">Default</Badge>}
              </SummaryFieldMeta>
            </SummaryFieldValue>
          </SummaryField>

          <Spacer size={20} />
        </>
      )}

      <AuthConfigDetailsFields
        collectAuthConfigDetails={p.collectAuthConfigDetails}
        authConfigDetailsForm={p.authConfigDetailsForm}
        disabled={p.disabled}
      />
    </>
  );
};

export let MethodSelectionStep = (p: {
  methodForm: AnyForm;
  authMethods: any;
  lockedVersionId?: string;
  selectedMethodId: string;
  onMethodChange: (value: string) => void;
  onCancel?: () => void;
  cancelLabel: string;
}) => {
  return {
    title: 'Authentication',
    subtitle: 'Select auth method',
    render: () => (
      <form onSubmit={p.methodForm.handleSubmit}>
        {!p.lockedVersionId && (
          <>
            <Text size="1" color="gray600">
              This deployment is not pinned. Authentication methods are being loaded from the
              provider&apos;s current version.
            </Text>
            <Spacer size={6} />
          </>
        )}

        <AuthMethodPicker
          hideLabel
          focusOnMount
          value={p.selectedMethodId}
          onChange={p.onMethodChange}
          items={(p.authMethods.data?.items ?? []).map((method: any) => ({
            id: method.id,
            name: method.name,
            description: method.description
          }))}
        />

        <p.methodForm.RenderError field="selectedMethodId" />

        <Spacer size={8} />
        <Flex gap={8}>
          {p.onCancel && (
            <Button type="button" variant="outline" onClick={p.onCancel}>
              {p.cancelLabel}
            </Button>
          )}
          <Button type="submit" disabled={!p.selectedMethodId}>
            Continue
          </Button>
        </Flex>
      </form>
    )
  } satisfies SetupStep;
};

export let CredentialsSelectionStep = (p: {
  credentialsForm: AnyForm;
  selectedCredentialId: string;
  hasSelectedCredential: boolean;
  hideCredentialsIntro: boolean;
  oauthMethodName: string;
  showManagedChoiceStep: boolean;
  showExternalPreviewSidebar: boolean;
  credentialSelectItems: CredentialSelectItem[];
  handleCredentialSelectionChange: (value: string) => void;
  hasManagedVisibleCredentials: boolean;
  redirectUri?: string;
  isCustomSelected: boolean;
  isCreatingCredentials: boolean;
  disableCredentialSelection?: boolean;
  projectBrandImageUrl?: string | null;
  projectBrandName: string;
  providerName: string;
  providerImageUrl?: string | null;
  isManagedSelected: boolean;
  error: string | null;
  createCredentials: { isPending: boolean; RenderError: () => ReactNode };
  showHiddenMethodStep: boolean;
  includeMethodStep: boolean;
  skipMethodStep: boolean;
  onBackToMethodSelection?: () => void;
  onBack: () => void;
}) => {
  return {
    title: 'Select',
    subtitle: 'Select existing or add credentials',
    render: () => (
      <form onSubmit={p.credentialsForm.handleSubmit}>
        {!p.hideCredentialsIntro && (
          <>
            <Text size="2" weight="strong">
              Select {p.oauthMethodName} Credentials
            </Text>
            <Text size="2" color="gray600">
              Select existing credentials or add new credentials to continue.
            </Text>
            <Spacer size={6} />
          </>
        )}

        {p.showManagedChoiceStep ? (
          <ManagedCredentialsLayout
            style={p.showExternalPreviewSidebar ? { gridTemplateColumns: '1fr' } : undefined}
          >
            <ManagedCredentialsColumn>
              <CredentialsSelector
                credentialsForm={p.credentialsForm}
                selectedCredentialId={p.selectedCredentialId}
                credentialSelectItems={p.credentialSelectItems}
                handleCredentialSelectionChange={p.handleCredentialSelectionChange}
                hasManagedVisibleCredentials={p.hasManagedVisibleCredentials}
                isCreatingCredentials={p.isCreatingCredentials}
                redirectUri={p.redirectUri}
                isCustomSelected={p.isCustomSelected}
                disableCredentialSelection={p.disableCredentialSelection}
              />
            </ManagedCredentialsColumn>

            {!p.showExternalPreviewSidebar && (
              <ManagedCredentialsPreviewPanel
                projectBrandImageUrl={p.projectBrandImageUrl}
                projectBrandName={p.projectBrandName}
                providerName={p.providerName}
                providerImageUrl={p.providerImageUrl}
                hasManagedVisibleCredentials={p.hasManagedVisibleCredentials}
                isManagedSelected={p.isManagedSelected}
              />
            )}
          </ManagedCredentialsLayout>
        ) : (
          <CredentialsSelector
            credentialsForm={p.credentialsForm}
            selectedCredentialId={p.selectedCredentialId}
            credentialSelectItems={p.credentialSelectItems}
            handleCredentialSelectionChange={p.handleCredentialSelectionChange}
            hasManagedVisibleCredentials={p.hasManagedVisibleCredentials}
            isCreatingCredentials={p.isCreatingCredentials}
            redirectUri={p.redirectUri}
            isCustomSelected={p.isCustomSelected}
            disableCredentialSelection={p.disableCredentialSelection}
          />
        )}

        <p.createCredentials.RenderError />

        {p.error && (
          <>
            <Spacer size={5} />
            <Text size="2" color="red600">
              {p.error}
            </Text>
          </>
        )}

        <Spacer size={12} />

        <Flex gap={8}>
          {!p.showHiddenMethodStep && p.includeMethodStep && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (p.skipMethodStep) {
                  p.onBackToMethodSelection?.();
                  return;
                }

                p.onBack();
              }}
            >
              Back
            </Button>
          )}

          <Button
            type="submit"
            loading={p.createCredentials.isPending}
            disabled={
              (p.isCreatingCredentials &&
                (!p.credentialsForm.values.newCredName ||
                  !p.credentialsForm.values.newCredClientId ||
                  !p.credentialsForm.values.newCredClientSecret)) ||
              (!p.isCreatingCredentials && !p.hasSelectedCredential)
            }
          >
            Continue
          </Button>
        </Flex>
      </form>
    )
  } satisfies SetupStep;
};

export let FlatOAuthConnectStep = (p: {
  collectAuthConfigDetails: boolean;
  authConfigDetailsForm: AnyForm;
  selectedCredentialId: string;
  hasSelectedCredential: boolean;
  redirectUri?: string;
  isCustomSelected: boolean;
  credentialsForm: AnyForm;
  isCreatingCredentials: boolean;
  disableCredentialSelection?: boolean;
  credentialSelectItems: CredentialSelectItem[];
  handleCredentialSelectionChange: (value: string) => void;
  hasManagedVisibleCredentials: boolean;
  createCredentials: { isPending: boolean; RenderError: () => ReactNode };
  createSetupSession: { isPending: boolean; RenderError: () => ReactNode };
  error: string | null;
  setupSession: SetupSessionState | null;
  setupWindowBlocked: boolean;
  onCancel?: () => void;
  cancelLabel: string;
  onWindowOpenCancel?: () => void;
  windowOpenCancelLabel: string;
  isStarting: boolean;
  resolveSelectedCredentialId: () => Promise<string | null>;
  handleStartSetup: (providerAuthCredentialsId?: string) => Promise<SetupSessionState | null>;
  openSetupWindow: () => boolean;
}) => {
  return {
    title: 'Connect',
    subtitle: 'Complete authentication',
    render: () => {
      let isWindowOpen = !!p.setupSession?.url;

      return (
        <form
          onSubmit={async e => {
            e.preventDefault();

            if (isWindowOpen) return;

            if (p.isCustomSelected && !p.hasSelectedCredential && !p.isCreatingCredentials) {
              p.credentialsForm.setFieldTouched('selectedCredentialId', true, false);
              await p.credentialsForm.validateField('selectedCredentialId');
              return;
            }

            let providerAuthCredentialsId = await p.resolveSelectedCredentialId();
            if (p.isCustomSelected && !providerAuthCredentialsId) return;

            await p.handleStartSetup(providerAuthCredentialsId ?? undefined);
          }}
        >
          <FlatConnectForm>
            <AuthConfigDetailsFields
              collectAuthConfigDetails={p.collectAuthConfigDetails}
              authConfigDetailsForm={p.authConfigDetailsForm}
              disabled={isWindowOpen}
            />

            <FlatConnectSection>
              <CredentialsSelector
                credentialsForm={p.credentialsForm}
                selectedCredentialId={p.selectedCredentialId}
                credentialSelectItems={p.credentialSelectItems}
                handleCredentialSelectionChange={p.handleCredentialSelectionChange}
                hasManagedVisibleCredentials={p.hasManagedVisibleCredentials}
                redirectUri={p.redirectUri}
                isCreatingCredentials={p.isCreatingCredentials}
                isCustomSelected={p.isCustomSelected}
                disableCredentialSelection={p.disableCredentialSelection}
                disabled={isWindowOpen}
              />
            </FlatConnectSection>
          </FlatConnectForm>

          <p.createCredentials.RenderError />
          <p.createSetupSession.RenderError />

          {p.error && (
            <>
              <Spacer size={5} />
              <Text size="2" color="red600">
                {p.error}
              </Text>
            </>
          )}

          <Spacer size={8} />

          {isWindowOpen ? (
            <>
              {p.setupWindowBlocked && (
                <>
                  <Text size="2" color="red600">
                    The popup window was blocked by your browser. Open it manually to continue.
                  </Text>
                  <Spacer size={5} />
                </>
              )}

              <Text size="2" weight="medium">
                Continue in the authentication window
              </Text>

              <Spacer size={8} />

              <Flex gap={8} align="center">
                {(p.onWindowOpenCancel ?? p.onCancel) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={p.onWindowOpenCancel ?? p.onCancel}
                  >
                    {p.onWindowOpenCancel ? p.windowOpenCancelLabel : p.cancelLabel}
                  </Button>
                )}

                <Button type="button" onClick={() => p.openSetupWindow()}>
                  Reopen Window
                </Button>
              </Flex>
            </>
          ) : (
            <Flex gap={8} align="center">
              {p.onCancel && (
                <Button type="button" variant="outline" onClick={p.onCancel}>
                  {p.cancelLabel}
                </Button>
              )}
              <Button
                type="submit"
                loading={
                  p.isStarting ||
                  p.createSetupSession.isPending ||
                  p.createCredentials.isPending
                }
                disabled={
                  (p.isCreatingCredentials &&
                    (!p.credentialsForm.values.newCredName ||
                      !p.credentialsForm.values.newCredClientId ||
                      !p.credentialsForm.values.newCredClientSecret)) ||
                  (p.isCustomSelected && !p.isCreatingCredentials && !p.hasSelectedCredential)
                }
              >
                Continue
              </Button>
            </Flex>
          )}
        </form>
      );
    }
  } satisfies SetupStep;
};

export let ConnectStep = (p: {
  connectSubtitle: string;
  setupSession: SetupSessionState | null;
  setupWindowBlocked: boolean;
  selectedCredentialLabel: string;
  hasCredentialsStep: boolean;
  isManagedSelected: boolean;
  isSelectedCredentialDefault: boolean;
  collectAuthConfigDetails: boolean;
  authConfigDetailsForm: AnyForm;
  oauthMethodName: string;
  onWindowOpenCancel?: () => void;
  onCancel?: () => void;
  windowOpenCancelLabel: string;
  cancelLabel: string;
  openSetupWindow: () => boolean;
  skipMethodStep: boolean;
  onBackToMethodSelection?: () => void;
  resetSetupSession: () => void;
  onBack: () => void;
  error: string | null;
  isOAuth: boolean;
  providerName: string;
  createSetupSession: { isPending: boolean; RenderError: () => ReactNode };
  handleStartSetup: () => Promise<SetupSessionState | null>;
  isStarting: boolean;
  selectedMethodId: string;
  isFirstVisibleStep: boolean;
}) => {
  return {
    title: 'Connect',
    subtitle: p.connectSubtitle,
    render: () => {
      if (p.setupSession?.url) {
        return (
          <>
            <ConnectSummary
              hasCredentialsStep={p.hasCredentialsStep}
              selectedCredentialLabel={p.selectedCredentialLabel}
              isManagedSelected={p.isManagedSelected}
              isSelectedCredentialDefault={p.isSelectedCredentialDefault}
              collectAuthConfigDetails={p.collectAuthConfigDetails}
              authConfigDetailsForm={p.authConfigDetailsForm}
              disabled
            />

            {p.setupWindowBlocked && (
              <>
                <Spacer size={5} />
                <Text size="2" color="red600">
                  The popup window was blocked by your browser. Open it manually to continue.
                </Text>
              </>
            )}

            <Spacer size={6} />

            <Text size="2" weight="strong">
              Continue in the {p.oauthMethodName} window
            </Text>
            <Text size="2" color="gray600">
              Complete the sign-in flow. This modal will update automatically.
            </Text>

            <Spacer size={8} />

            <Flex gap={8} align="center">
              {(p.onWindowOpenCancel ?? p.onCancel) && (
                <Button
                  size="1"
                  variant="outline"
                  onClick={p.onWindowOpenCancel ?? p.onCancel}
                >
                  {p.onWindowOpenCancel ? p.windowOpenCancelLabel : p.cancelLabel}
                </Button>
              )}

              <Button size="1" onClick={() => p.openSetupWindow()}>
                Reopen Window
              </Button>
            </Flex>

            {(!p.skipMethodStep || p.onBackToMethodSelection) && (
              <>
                <Spacer size={8} />
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    p.resetSetupSession();
                    if (p.skipMethodStep) {
                      p.onBackToMethodSelection?.();
                      return;
                    }

                    p.onBack();
                  }}
                >
                  <Text size="1" color="gray500" style={{ textDecoration: 'underline' }}>
                    Change method
                  </Text>
                </span>
              </>
            )}

            {p.error && (
              <>
                <Spacer size={5} />
                <Text size="2" color="red600">
                  {p.error}
                </Text>
              </>
            )}
          </>
        );
      }

      return (
        <>
          <ConnectSummary
            hasCredentialsStep={p.hasCredentialsStep}
            selectedCredentialLabel={p.selectedCredentialLabel}
            isManagedSelected={p.isManagedSelected}
            isSelectedCredentialDefault={p.isSelectedCredentialDefault}
            collectAuthConfigDetails={p.collectAuthConfigDetails}
            authConfigDetailsForm={p.authConfigDetailsForm}
          />

          <Spacer size={12} />

          <Text size="2" weight="strong">
            {p.isOAuth ? 'Start Authentication' : 'Start setup'}
          </Text>
          <Text size="2" color="gray600">
            {p.isOAuth
              ? `A separate window will open so you can authorize ${p.providerName}.`
              : 'Start the setup session for this authentication method.'}
          </Text>

          <p.createSetupSession.RenderError />

          {p.error && (
            <>
              <Spacer size={5} />
              <Text size="2" color="red600">
                {p.error}
              </Text>
            </>
          )}

          <Spacer size={8} />

          <Flex gap={8} align="center">
            <Button
              type="button"
              onClick={() => void p.handleStartSetup()}
              loading={p.isStarting || p.createSetupSession.isPending}
              disabled={!p.selectedMethodId}
            >
              {p.isOAuth ? 'Open Window' : 'Start Setup'}
            </Button>

            {!p.isFirstVisibleStep && (
              <Button type="button" variant="outline" onClick={p.onBack}>
                Back
              </Button>
            )}
          </Flex>
        </>
      );
    }
  } satisfies SetupStep;
};
