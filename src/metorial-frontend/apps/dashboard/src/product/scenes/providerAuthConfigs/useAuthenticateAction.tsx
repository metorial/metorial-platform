import {
  instanceProviderAuthConfigsLoader,
  useProviderAuthCredentials,
  useProviderListing
} from '@metorial/state';
import { Button, Dialog, Spacer, Text, showModal, toast } from '@metorial/ui';
import { useEffect, useRef } from 'react';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { useProviderSetupSessionRunner } from '../providerDeployments/setupSessionRunner';
import {
  getProviderAuthCredentialsQuery,
  getRememberedProviderAuthCredentialId
} from './credentialPicker';
import { showProviderAuthConfigCreateModal } from './createModal';
import { type AuthMethod, getGeneratedAuthConfigName, isSetupFlowAuthMethod } from './modalHelpers';

let WINDOW_DIALOG_DURATION_MS = 45_000;

let AuthenticationWindowDialog = (p: {
  providerName: string;
  onReopen: () => void;
  onCancel: () => void;
}) => (
  <>
    <Dialog.Title>Authenticate with {p.providerName}</Dialog.Title>
    <Dialog.Description>Finish signing in from the authentication window.</Dialog.Description>
    <Spacer size={16} />

    <Text size="2" weight="strong">
      Continue in the authentication window
    </Text>
    <Text size="2" color="gray600">
      This will update automatically once you have signed in.
    </Text>

    <Spacer size={16} />

    <Dialog.Actions>
      <Button type="button" variant="outline" onClick={p.onCancel}>
        Cancel
      </Button>
      <Button type="button" onClick={p.onReopen}>
        Reopen Window
      </Button>
    </Dialog.Actions>
  </>
);

export let useProviderAuthConfigAuthenticateAction = (p: {
  instanceId: string;
  providerDeploymentId?: string;
  providerId?: string;
  fixedAuthMethodId?: string;
  fixedAuthCredentialsId?: string;
  authMethodAdapter?: string;
  defaultAuthConfigName?: string;
  onCreate?: (authConfig: { id: string; name?: string | null }) => void;
  onBack?: () => void;
}) => {
  let authCreation = useProviderAuthCreationCapabilities(
    p.instanceId,
    p.providerDeploymentId,
    p.providerId,
    p.authMethodAdapter
  );
  let providerId =
    p.providerId ?? authCreation.deployment.data?.providerId ?? authCreation.provider.data?.id;
  let providerListing = useProviderListing(p.instanceId, providerId);
  let providerName =
    providerListing.data?.name ?? authCreation.provider.data?.name ?? 'Provider';

  let oauthMethods = authCreation.authMethodItems.filter(isSetupFlowAuthMethod);
  let primaryOAuthMethod = p.fixedAuthMethodId
    ? oauthMethods.find(method => method.id === p.fixedAuthMethodId)
    : oauthMethods.length === 1
      ? oauthMethods[0]
      : undefined;
  let needsCredentials =
    !authCreation.oauthAutoRegistrationEnabled && !p.fixedAuthCredentialsId;

  let credentials = useProviderAuthCredentials(
    p.instanceId,
    providerId && primaryOAuthMethod && needsCredentials
      ? getProviderAuthCredentialsQuery({
          providerId,
          providerAuthMethodId: primaryOAuthMethod.id
        })
      : null
  );

  let isPreparing =
    !!providerId &&
    !!primaryOAuthMethod &&
    needsCredentials &&
    !credentials.data &&
    !credentials.error;

  let runner = useProviderSetupSessionRunner({
    instanceId: p.instanceId,
    providerId: providerId ?? '',
    providerDeploymentId: p.providerDeploymentId,
    onComplete: setupSession => {
      runner.reset();
      if (!setupSession.authConfig) return;
      void instanceProviderAuthConfigsLoader.refetchAll();
      p.onCreate?.(setupSession.authConfig);
    },
    onWindowClosed: () => {}
  });

  let runnerRef = useRef(runner);
  runnerRef.current = runner;
  let closeDialogRef = useRef<(() => void) | null>(null);
  let startedDirectlyRef = useRef(false);

  let closeWindowDialog = () => {
    closeDialogRef.current?.();
    closeDialogRef.current = null;
  };

  useEffect(() => {
    if (!runner.isWindowOpen) {
      startedDirectlyRef.current = false;
      closeWindowDialog();
      return;
    }

    if (!startedDirectlyRef.current) return;

    showModal(({ dialogProps, close }) => {
      closeDialogRef.current = close;
      return (
        <Dialog.Wrapper {...dialogProps} width={450}>
          <AuthenticationWindowDialog
            providerName={providerName}
            onReopen={() => runnerRef.current.openWindow()}
            onCancel={() => {
              runnerRef.current.reset();
              close();
            }}
          />
        </Dialog.Wrapper>
      );
    });

    let remaining = WINDOW_DIALOG_DURATION_MS;
    let resumedAt = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    let resume = () => {
      if (timeout) return;
      resumedAt = Date.now();
      timeout = setTimeout(closeWindowDialog, remaining);
    };

    let pause = () => {
      if (!timeout) return;
      clearTimeout(timeout);
      timeout = undefined;
      remaining = Math.max(0, remaining - (Date.now() - resumedAt));
    };

    if (!document.hasFocus()) resume();
    window.addEventListener('blur', resume);
    window.addEventListener('focus', pause);

    return () => {
      pause();
      window.removeEventListener('blur', resume);
      window.removeEventListener('focus', pause);
      closeWindowDialog();
    };
  }, [runner.isWindowOpen]);

  useEffect(() => {
    if (!runner.error) return;
    toast.error(runner.error);
    runner.setError(null);
  }, [runner.error]);

  useEffect(() => {
    if (!runner.windowBlocked) return;
    toast.error(
      'Your browser blocked the authentication window. Allow pop-ups for this site and try again.'
    );
    runner.reset();
  }, [runner.windowBlocked]);

  let getDirectCredentials = (method: AuthMethod) => {
    if (!needsCredentials) return { providerAuthCredentialsId: p.fixedAuthCredentialsId };
    if (method.id !== primaryOAuthMethod?.id || !credentials.data) return null;

    let items = credentials.data.items;
    let remembered = getRememberedProviderAuthCredentialId(items);
    if (remembered) return { providerAuthCredentialsId: remembered };

    if (items.length !== 1 || credentials.data.pagination.hasMoreAfter) return null;

    return { providerAuthCredentialsId: items[0]!.id };
  };

  let openModal = (authMethodId: string) =>
    showProviderAuthConfigCreateModal({
      instanceId: p.instanceId,
      providerDeploymentId: p.providerDeploymentId,
      providerId: p.providerId,
      initialAuthMethodId: authMethodId,
      fixedAuthCredentialsId: p.fixedAuthCredentialsId,
      authMethodAdapter: p.authMethodAdapter,
      defaultAuthConfigName: p.defaultAuthConfigName,
      onCreate: p.onCreate,
      onBack: p.onBack
    });

  let start = (authMethodId: string) => {
    let method = authCreation.authMethodItems.find(method => method.id === authMethodId);
    let direct = method && providerId && isSetupFlowAuthMethod(method) && getDirectCredentials(method);

    if (!method || !direct) {
      openModal(authMethodId);
      return;
    }

    startedDirectlyRef.current = true;
    void runner.start({
      providerAuthMethodId: method.id,
      providerAuthCredentialsId: direct.providerAuthCredentialsId,
      name: getGeneratedAuthConfigName(p.defaultAuthConfigName, providerName)
    });
  };

  return {
    authCreation,
    providerName,
    start,
    isLoading: isPreparing || runner.isStarting || runner.isWindowOpen
  };
};
