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
let MAX_POLL_ATTEMPTS = 120;
let CLOSED_POLLS_BEFORE_CANCEL = 2;

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

let closeWindow = (popup: Window | null) => {
  if (popup && !popup.closed) popup.close();
};

export let useProviderSetupSessionRunner = (p: {
  instanceId: string;
  providerId: string;
  providerDeploymentId?: string;
  onComplete: (setupSession: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput) => void;
  onWindowClosed?: () => void;
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
  let onWindowClosedRef = useRef(p.onWindowClosed);
  let getSetupSessionRef = useRef(getSetupSession);

  onCompleteRef.current = p.onComplete;
  onWindowClosedRef.current = p.onWindowClosed;
  getSetupSessionRef.current = getSetupSession;

  useEffect(
    () => () => {
      if (!completedRef.current) closeWindow(windowRef.current);
    },
    []
  );

  let openWindow = (url = setupSession?.url) => {
    if (typeof window === 'undefined' || !url) return false;

    let popup = windowRef.current;
    if (!popup || popup.closed) {
      popup = window.open('', SETUP_WINDOW_NAME, SETUP_WINDOW_FEATURES);
      windowRef.current = popup;
    }
    if (!popup) return false;

    try {
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
      providerAuthCredentialsId
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
    if (!setupSession?.id) return;

    let canceled = false;
    let attempts = 0;
    let closedPolls = 0;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    let poll = async () => {
      if (canceled || completedRef.current) return;

      let [result, err] = await getSetupSessionRef.current.mutate({
        setupSessionId: setupSession.id
      });
      if (canceled) return;

      if (err) {
        console.warn('Failed to poll setup session:', err);
      } else if (result) {
        if (result.status === 'completed') {
          completedRef.current = true;
          closeWindow(windowRef.current);
          windowRef.current = null;
          setSetupSession(result);
          onCompleteRef.current(result);
          return;
        }

        if (result.status === 'failed' || result.status === 'expired') {
          setError(
            result.status === 'expired'
              ? 'Setup session expired. Please start again.'
              : 'Setup session failed. Please try again.'
          );
          clearSession();
          return;
        }
      }

      let popup = windowRef.current;
      if (onWindowClosedRef.current && popup?.closed) {
        closedPolls += 1;
        if (closedPolls >= CLOSED_POLLS_BEFORE_CANCEL) {
          clearSession();
          onWindowClosedRef.current();
          return;
        }
      } else {
        closedPolls = 0;
      }

      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        setError('Authentication timed out. Please try again.');
        clearSession();
        return;
      }

      timeout = setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      canceled = true;
      if (timeout) clearTimeout(timeout);
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
    isWindowOpen: !!setupSession?.url && !completedRef.current
  };
};
