import {
  instanceProviderAuthConfigsLoader,
  useProviderAuthCredentialsForMethods,
  useProviderListing
} from '@metorial/state';
import { Button, Callout, Dialog, Spacer, Text, showModal, toast } from '@metorial/ui';
import { useEffect, useRef, useState } from 'react';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import {
  type SetupSessionCredentialError,
  useProviderSetupSessionRunner
} from '../providerDeployments/setupSessionRunner';
import {
  getProviderAuthCredentialsQuery,
  getRememberedProviderAuthCredentialId
} from './credentialPicker';
import { showProviderAuthConfigCreateModal } from './createModal';
import {
  type AuthMethod,
  getGeneratedAuthConfigName,
  isSetupFlowAuthMethod
} from './modalHelpers';

let AuthenticationWindowDialog = (p: {
  providerName: string;
  windowBlocked: boolean;
  onReopen: () => boolean;
  onCancel: () => void;
}) => {
  let [windowBlocked, setWindowBlocked] = useState(p.windowBlocked);
  return (
    <>
      <Dialog.Title>Authenticate with {p.providerName}</Dialog.Title>
      <Dialog.Description>
        Finish signing in from the authentication window.
      </Dialog.Description>
      <Spacer size={16} />

      <Text size="2" weight="strong">
        Continue in the authentication window
      </Text>
      <Text size="2" color="gray600">
        This will update automatically once you have signed in.
      </Text>

      {windowBlocked && (
        <>
          <Spacer size={12} />
          <Callout color="orange">
            Your browser blocked the sign-in window. Open it here to continue.
          </Callout>
        </>
      )}

      <Spacer size={16} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={() => setWindowBlocked(!p.onReopen())}>
          {windowBlocked ? 'Open Window' : 'Reopen Window'}
        </Button>
      </Dialog.Actions>
    </>
  );
};

export let useProviderAuthConfigAuthenticateAction = (p: {
  instanceId: string;
  providerDeploymentId?: string;
  providerId?: string;
  fixedAuthMethodId?: string;
  fixedAuthCredentialsId?: string;
  fixedAuthCredentialsSettingsHref?: string;
  authMethodAdapter?: string;
  defaultAuthConfigName?: string;
  source?: 'explorer';
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
  let credentialMethods = p.fixedAuthMethodId
    ? oauthMethods.filter(method => method.id === p.fixedAuthMethodId)
    : oauthMethods;
  let needsCredentials =
    !authCreation.oauthAutoRegistrationEnabled && !p.fixedAuthCredentialsId;

  let credentials = useProviderAuthCredentialsForMethods(
    p.instanceId,
    providerId && needsCredentials
      ? credentialMethods.map(method =>
          getProviderAuthCredentialsQuery({
            providerId,
            providerAuthMethodId: method.id
          })
        )
      : null
  );

  let isPreparing =
    !!providerId &&
    credentialMethods.length > 0 &&
    needsCredentials &&
    !credentials.data &&
    !credentials.error;

  let attemptedMethodId = useRef<string | null>(null);
  let rejectedCredentials = useRef(new Map<string, SetupSessionCredentialError>());
  let getMethodKey = (methodId: string) =>
    JSON.stringify([
      p.instanceId,
      providerId,
      p.providerDeploymentId,
      methodId,
      p.fixedAuthCredentialsId
    ]);

  let runner = useProviderSetupSessionRunner({
    instanceId: p.instanceId,
    providerId: providerId ?? '',
    providerDeploymentId: p.providerDeploymentId,
    source: p.source,
    onCredentialError: failure => {
      let authMethodId = attemptedMethodId.current;
      if (!authMethodId) return;

      rejectedCredentials.current.set(getMethodKey(authMethodId), failure);
      void credentials.refetch();
      openModal(authMethodId, failure);
    },
    onComplete: setupSession => {
      runner.reset();
      if (!setupSession.authConfig) return;
      void instanceProviderAuthConfigsLoader.refetchAll();
      p.onCreate?.(setupSession.authConfig);
    }
  });

  let runnerRef = useRef(runner);
  runnerRef.current = runner;
  let startedDirectlyRef = useRef(false);

  useEffect(() => {
    if (!runner.isAwaitingCompletion) {
      startedDirectlyRef.current = false;
      return;
    }

    if (!startedDirectlyRef.current) return;

    let modal = showModal(
      ({ dialogProps, close }) => (
        <Dialog.Wrapper {...dialogProps} width={450}>
          <AuthenticationWindowDialog
            providerName={providerName}
            windowBlocked={runner.windowBlocked}
            onReopen={() => runnerRef.current.openWindow()}
            onCancel={close}
          />
        </Dialog.Wrapper>
      ),
      { onClose: () => runnerRef.current.reset() }
    );

    return () => modal.close();
  }, [runner.isAwaitingCompletion]);

  useEffect(() => {
    if (!runner.error) return;
    toast.error(runner.error);
    runner.setError(null);
  }, [runner.error]);

  let getDirectCredentials = (method: AuthMethod) => {
    if (!needsCredentials) return { providerAuthCredentialsId: p.fixedAuthCredentialsId };
    let methodCredentials = credentials.data?.find(
      entry => entry.providerAuthMethodId === method.id
    )?.credentials;
    if (!methodCredentials) return null;

    let items = methodCredentials.items;
    let remembered = getRememberedProviderAuthCredentialId(items);
    if (remembered) return { providerAuthCredentialsId: remembered };

    if (
      items.length !== 1 ||
      methodCredentials.pagination.hasMoreAfter ||
      methodCredentials.pagination.hasMoreBefore
    ) {
      return null;
    }

    return { providerAuthCredentialsId: items[0]!.id };
  };

  let openModal = (authMethodId: string, credentialError?: SetupSessionCredentialError) =>
    showProviderAuthConfigCreateModal({
      instanceId: p.instanceId,
      providerDeploymentId: p.providerDeploymentId,
      providerId: p.providerId,
      initialAuthMethodId: authMethodId,
      fixedAuthCredentialsId: p.fixedAuthCredentialsId,
      fixedAuthCredentialsSettingsHref: p.fixedAuthCredentialsSettingsHref,
      authMethodAdapter: p.authMethodAdapter,
      defaultAuthConfigName: p.defaultAuthConfigName,
      source: p.source,
      credentialError,
      onCreate: authConfig => {
        rejectedCredentials.current.delete(getMethodKey(authMethodId));
        p.onCreate?.(authConfig);
      },
      onBack: p.onBack
    });

  let start = (authMethodId: string) => {
    let failure = rejectedCredentials.current.get(getMethodKey(authMethodId));
    if (failure) {
      openModal(authMethodId, failure);
      return;
    }

    let method = authCreation.authMethodItems.find(method => method.id === authMethodId);
    let direct =
      method && providerId && isSetupFlowAuthMethod(method) && getDirectCredentials(method);

    if (!method || !direct) {
      openModal(authMethodId);
      return;
    }

    startedDirectlyRef.current = true;
    attemptedMethodId.current = method.id;
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
    isLoading: isPreparing || runner.isStarting || runner.isAwaitingCompletion
  };
};
