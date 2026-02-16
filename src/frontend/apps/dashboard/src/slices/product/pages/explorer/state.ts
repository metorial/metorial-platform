import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import {
  useCreateSession,
  useProvider,
  useProviderAuthCredentials,
  useProviderAuthMethods,
  useProviderDeployment,
  useSession
} from '@metorial/state';
import { useCallback, useEffect, useRef, useState } from 'react';

export let authenticateWithOauth = async ({
  instanceId,
  providerDeploymentId
}: {
  instanceId: string;
  providerDeploymentId: string;
}): Promise<string> => {
  throw new Error('OAuth authentication not implemented yet');
};

export let useSessionForDeployment = (
  instanceId: string | null | undefined,
  deploymentId: string | null | undefined
) => {
  let createSession = useCreateSession(instanceId);
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let provider = useProvider(instanceId, deployment.data?.providerId);
  let authMethods = useProviderAuthMethods(instanceId, deployment.data?.providerId);
  let authCredentials = useProviderAuthCredentials(instanceId, deployment.data?.id);

  let [session, setSession] = useState<DashboardInstanceSessionsGetOutput | null>(null);
  let [authConfigId, setAuthConfigId] = useState<string | null>(null);

  let [state, setState] = useState<'loading' | 'error' | 'ready' | 'auth_required'>('loading');

  let lastAttemptRef = useRef<{ deploymentId: string; authConfigId: string | null } | null>(
    null
  );

  let tryCreateSession = useCallback(
    async (withAuthConfigId?: string) => {
      if (!instanceId || !deployment.data) return;

      let [res, error] = await createSession.mutate({
        providers: [
          {
            providerDeployment: deployment.data.id,
            ...(withAuthConfigId ? { providerAuthConfig: withAuthConfigId } : {})
          }
        ]
      });

      if (res) {
        setSession(res);
        setState('ready');
        return true;
      }

      if (error) {
        let errorCode = (error as any)?.code || (error as any)?.data?.code;
        let errorMessage = (error as any)?.message || '';

        if (
          errorCode === 'auth_config_required' ||
          errorCode === 'oauth_required' ||
          errorMessage.includes('auth_config') ||
          errorMessage.includes('auth config') ||
          errorMessage.includes('authentication required')
        ) {
          setState('auth_required');
          return false;
        }

        setState('error');
        return false;
      }

      setState('error');
      return false;
    },
    [instanceId, deployment.data?.id, createSession, authMethods.data?.items]
  );

  useEffect(() => {
    (async () => {
      if (!instanceId || !deployment.data) return;

      if (authMethods.isLoading) return;

      let attemptKey = { deploymentId: deployment.data.id, authConfigId };
      if (
        lastAttemptRef.current?.deploymentId === attemptKey.deploymentId &&
        lastAttemptRef.current?.authConfigId === attemptKey.authConfigId
      ) {
        return;
      }
      lastAttemptRef.current = attemptKey;

      let hasAuthMethods = authMethods.data?.items && authMethods.data.items.length > 0;
      if (hasAuthMethods && !authConfigId) {
        setState('auth_required');
        return;
      }

      await tryCreateSession(authConfigId ?? undefined);
    })().catch(() => {
      setState('error');
    });
  }, [
    instanceId,
    deployment.data?.id,
    authConfigId,
    authMethods.isLoading,
    authMethods.data?.items
  ]);

  let onAuthComplete = useCallback((newAuthConfigId: string) => {
    setAuthConfigId(newAuthConfigId);
    lastAttemptRef.current = null;
    setState('loading');
  }, []);

  let sessionGetter = useSession(instanceId, session?.id);

  let sessionData = sessionGetter.data ?? session;

  return {
    ...sessionGetter,
    data: sessionData,
    error: sessionGetter.error ?? createSession.error ?? deployment.error,
    isLoading: sessionGetter.isLoading || state === 'loading',
    state,
    onAuthComplete,
    refetchAuthCredentials: authCredentials.refetch,
    provider: provider.data,
    authMethods: authMethods.data?.items ?? [],
    authCredentials: authCredentials.data?.items ?? [],
    deployment: deployment.data
  };
};
