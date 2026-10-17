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
import { ProviderDocsLink, type ProviderDocReference } from '../../../lib/providerDocs';
import { AuthMethodPicker } from '../../providerAuthConfigs/authMethodPicker';
import {
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

export let RedirectUriField = (p: {
  redirectUri: string;
  configDoc?: ProviderDocReference | null;
}) => {
  return (
    <>
      <Spacer size={12} />
      <Text size="1" weight="medium" color="gray900">
        Redirect URI
      </Text>
      <Text size="1" color="gray600" style={{ marginBottom: 5 }}>
        You must configure this redirect URI in your OAuth app.
        {p.configDoc ? (
          <>
            {' '}
            <ProviderDocsLink doc={p.configDoc} />
          </>
        ) : null}
      </Text>
      <Copy value={p.redirectUri} />
    </>
  );
};

let NewCredentialsFields = (p: {
  credentialsForm: AnyForm;
  providerDoc?: ProviderDocReference | null;
  disabled?: boolean;
}) => {
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
        help={<ProviderDocsLink doc={p.providerDoc} />}
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
  providerDoc?: ProviderDocReference | null;
  configDoc?: ProviderDocReference | null;
  isCustomSelected: boolean;
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
        description="Select existing credentials or add new ones for this provider."
        value={
          p.credentialsForm.values.credentialMode === 'new'
            ? '__create_new__'
            : p.selectedCredentialId
        }
        placeholder="Select or add credentials"
        disabled={p.disabled}
        onChange={p.handleCredentialSelectionChange}
        items={p.credentialSelectItems}
      />
      <p.credentialsForm.RenderError field="selectedCredentialId" />

      {p.hasManagedVisibleCredentials && (
        <>
          <Spacer size={5} />
          <Text size="1" color="gray600">
            Metorial Managed credentials are available for quick testing, or choose Add
            credentials to use your own OAuth app.
          </Text>
        </>
      )}

      {shouldShowRedirectUri && p.redirectUri && (
        <RedirectUriField redirectUri={p.redirectUri} configDoc={p.configDoc} />
      )}

      {p.isCreatingCredentials && (
        <NewCredentialsFields
          credentialsForm={p.credentialsForm}
          providerDoc={p.providerDoc}
          disabled={p.disabled}
        />
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
  oauthMethodName: string;
  credentialSelectItems: CredentialSelectItem[];
  handleCredentialSelectionChange: (value: string) => void;
  hasManagedVisibleCredentials: boolean;
  redirectUri?: string;
  providerDoc?: ProviderDocReference | null;
  configDoc?: ProviderDocReference | null;
  isCustomSelected: boolean;
  isCreatingCredentials: boolean;
  projectBrandImageUrl?: string | null;
  projectBrandName: string;
  providerName: string;
  providerImageUrl?: string | null;
  isManagedSelected: boolean;
  error: string | null;
  createCredentials: { isPending: boolean; RenderError: () => ReactNode };
  includeMethodStep: boolean;
  onBack: () => void;
}) => {
  return {
    title: 'Select',
    subtitle: 'Select existing or add credentials',
    render: () => (
      <form onSubmit={p.credentialsForm.handleSubmit}>
        <Text size="2" weight="strong">
          Select {p.oauthMethodName} Credentials
        </Text>
        <Text size="2" color="gray600">
          Select existing credentials or add new credentials to continue.
        </Text>
        <Spacer size={6} />

        <ManagedCredentialsLayout>
          <ManagedCredentialsColumn>
            <CredentialsSelector
              credentialsForm={p.credentialsForm}
              selectedCredentialId={p.selectedCredentialId}
              credentialSelectItems={p.credentialSelectItems}
              handleCredentialSelectionChange={p.handleCredentialSelectionChange}
              hasManagedVisibleCredentials={p.hasManagedVisibleCredentials}
              isCreatingCredentials={p.isCreatingCredentials}
              redirectUri={p.redirectUri}
              providerDoc={p.providerDoc}
              configDoc={p.configDoc}
              isCustomSelected={p.isCustomSelected}
            />
          </ManagedCredentialsColumn>

          <ManagedCredentialsPreviewPanel
            projectBrandImageUrl={p.projectBrandImageUrl}
            projectBrandName={p.projectBrandName}
            providerName={p.providerName}
            providerImageUrl={p.providerImageUrl}
            hasManagedVisibleCredentials={p.hasManagedVisibleCredentials}
            isManagedSelected={p.isManagedSelected}
          />
        </ManagedCredentialsLayout>

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
          {p.includeMethodStep && (
            <Button type="button" variant="outline" onClick={p.onBack}>
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

export let ConnectStep = (p: {
  connectSubtitle: string;
  setupSession: SetupSessionState | null;
  setupWindowBlocked: boolean;
  selectedCredentialLabel: string;
  hasCredentialsStep: boolean;
  isManagedSelected: boolean;
  isSelectedCredentialDefault: boolean;
  oauthMethodName: string;
  onCancel?: () => void;
  cancelLabel: string;
  openSetupWindow: () => boolean;
  showChangeMethod: boolean;
  resetSetupSession: () => void;
  onBack: () => void;
  error: string | null;
  isOAuth: boolean;
  providerName: string;
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
              {p.onCancel && (
                <Button size="1" variant="outline" onClick={p.onCancel}>
                  {p.cancelLabel}
                </Button>
              )}

              <Button size="1" onClick={() => p.openSetupWindow()}>
                Reopen Window
              </Button>
            </Flex>

            {p.showChangeMethod && (
              <>
                <Spacer size={8} />
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    p.resetSetupSession();
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
              loading={p.isStarting}
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
