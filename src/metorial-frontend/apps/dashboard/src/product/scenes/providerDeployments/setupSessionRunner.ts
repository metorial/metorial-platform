import {
  useCreateProviderSetupSession,
  useGetProviderSetupSession,
  type DashboardInstanceProviderDeploymentsSetupSessionsGetOutput
} from '@metorial/state';
import { useEffect, useRef, useState } from 'react';
import type { SetupSessionState } from './setupSessionEmbed/types';

let SETUP_WINDOW_NAME = 'metorial_provider_setup';
let SETUP_WINDOW_FEATURES = 'popup,width=560,height=760';
let POLL_INTERVAL_MS = 2000;
let EXPIRY_GRACE_MS = 60_000;

let FAILED_STATUS_MESSAGES: Partial<Record<SetupSessionState['status'], string>> = {
  failed: 'Setup session failed. Please try again.',
  expired: 'Setup session expired. Please start again.',
  archived: 'Setup session is no longer available. Please start again.',
  deleted: 'Setup session is no longer available. Please start again.'
};

export type SetupSessionStartInput = {
  providerAuthMethodId: string;
  providerAuthCredentialsId?: string;
  resolveProviderAuthCredentialsId?: () => Promise<string | null>;
  name?: string;
  description?: string;
  openWindow?: boolean;
};

let getErrorMessage = (err: unknown) => {
  if (err && typeof err === 'object') {
    if ('response' in err) {
      let message = (err as { response?: { message?: string } }).response?.message;
      if (message) return message;
    }
    if ('message' in err) {
      let message = String((err as { message?: string }).message ?? '');
      if (message) return message;
    }
  }

  return 'Failed to create setup session.';
};

let isPastExpiry = (setupSession: SetupSessionState) => {
  let expiresAt = new Date(setupSession.expiresAt).getTime();
  return Number.isFinite(expiresAt) && Date.now() > expiresAt + EXPIRY_GRACE_MS;
};

let closeWindow = (popup: Window | null) => {
  try {
    if (popup && !popup.closed) popup.close();
  } catch {}
};

// Once the setup window navigates to a provider that sets Cross-Origin-Opener-Policy,
// the browser severs our handle: `popup.closed` reports true while the window is still
// open. The window handle is therefore only used to open/close the window — the setup
// session status from the API is the sole source of truth for progress.
export let useProviderSetupSessionRunner = (p: {
  instanceId: string;
  providerId: string;
  providerDeploymentId?: string;
  ownedByCaller?: boolean;
  onComplete: (
    setupSession: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput
  ) => void;
}) => {
  let createSetupSession = useCreateProviderSetupSession(
    p.instanceId,
    p.providerId,
    p.providerDeploymentId
  );
  let getSetupSession = useGetProviderSetupSession(p.instanceId);

  let [isStarting, setIsStarting] = useState(false);
  let [error, setError] = useState<string | null>(null);
  let [setupSession, setSetupSession] = useState<SetupSessionState | null>(null);
  let [windowBlocked, setWindowBlocked] = useState(false);

  let windowRef = useRef<Window | null>(null);
  let completedRef = useRef(false);
  let onCompleteRef = useRef(p.onComplete);
  let getSetupSessionRef = useRef(getSetupSession);

  onCompleteRef.current = p.onComplete;
  getSetupSessionRef.current = getSetupSession;

  useEffect(
    () => () => {
      if (!completedRef.current) closeWindow(windowRef.current);
    },
    []
  );

  let openWindow = (url = setupSession?.url) => {
    if (typeof window === 'undefined' || !url) return false;

    try {
      let popup = windowRef.current;
      if (!popup || popup.closed) {
        popup = window.open('', SETUP_WINDOW_NAME, SETUP_WINDOW_FEATURES);
        windowRef.current = popup;
      }
      if (!popup) return false;

      popup.location.href = url;
      popup.focus();
      return true;
    } catch {
      return false;
    }
  };

  let clearSession = () => {
    closeWindow(windowRef.current);
    windowRef.current = null;
    setSetupSession(null);
    setWindowBlocked(false);
  };

  let reset = () => {
    clearSession();
    completedRef.current = false;
    setIsStarting(false);
    setError(null);
  };

  let start = async (input: SetupSessionStartInput) => {
    reset();
    setIsStarting(true);

    let shouldOpenWindow = input.openWindow ?? true;
    if (shouldOpenWindow && typeof window !== 'undefined') {
      windowRef.current = window.open('', SETUP_WINDOW_NAME, SETUP_WINDOW_FEATURES);
    }

    let fail = (message: string | null) => {
      closeWindow(windowRef.current);
      windowRef.current = null;
      setIsStarting(false);
      if (message) setError(message);
      return null;
    };

    let providerAuthCredentialsId = input.providerAuthCredentialsId;
    if (input.resolveProviderAuthCredentialsId) {
      let resolved = await input.resolveProviderAuthCredentialsId();
      if (!resolved) return fail(null);
      providerAuthCredentialsId = resolved;
    }

    let [session, err] = await createSetupSession.mutate({
      name: input.name?.trim() || undefined,
      description: input.description?.trim() || undefined,
      providerAuthMethodId: input.providerAuthMethodId,
      providerAuthCredentialsId,
      ...(p.ownedByCaller ? { ownedByCaller: true } : {})
    });

    if (err || !session) {
      console.error('Failed to create setup session:', err);
      return fail(getErrorMessage(err));
    }

    setIsStarting(false);
    setSetupSession(session);

    if (session.url) {
      setWindowBlocked(!openWindow(session.url));
    }

    return session;
  };

  useEffect(() => {
    if (!setupSession) return;

    let setupSessionId = setupSession.id;
    let latest: SetupSessionState = setupSession;
    let canceled = false;
    let inFlight = false;
    let pollAgain = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    let stop = (message: string) => {
      canceled = true;
      setError(message);
      clearSession();
    };

    let poll = async () => {
      if (canceled || completedRef.current) return;
      if (inFlight) {
        pollAgain = true;
        return;
      }

      if (timeout) clearTimeout(timeout);
      timeout = null;
      inFlight = true;

      let [result, err] = await getSetupSessionRef.current.mutate({ setupSessionId });

      inFlight = false;
      if (canceled) return;

      if (err || !result) {
        console.warn('Failed to poll setup session:', err);
      } else {
        latest = result;

        if (result.status === 'completed') {
          completedRef.current = true;
          closeWindow(windowRef.current);
          windowRef.current = null;
          setSetupSession(result);
          onCompleteRef.current(result);
          return;
        }

        let failedMessage = FAILED_STATUS_MESSAGES[result.status];
        if (failedMessage) return stop(failedMessage);
      }

      if (isPastExpiry(latest)) return stop(FAILED_STATUS_MESSAGES.expired!);

      if (pollAgain) {
        pollAgain = false;
        void poll();
        return;
      }

      timeout = setTimeout(poll, POLL_INTERVAL_MS);
    };

    let pollWhenVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };

    window.addEventListener('focus', pollWhenVisible);
    document.addEventListener('visibilitychange', pollWhenVisible);

    void poll();

    return () => {
      canceled = true;
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('focus', pollWhenVisible);
      document.removeEventListener('visibilitychange', pollWhenVisible);
    };
  }, [setupSession?.id]);

  return {
    start,
    reset,
    openWindow,
    setError,
    error,
    isStarting,
    setupSession,
    windowBlocked,
    isAwaitingCompletion: !!setupSession?.url && !completedRef.current
  };
};
