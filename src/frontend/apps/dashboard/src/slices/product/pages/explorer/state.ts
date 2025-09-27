import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import {
  useCreateOAuthSession,
  useCreateSession,
  useGetOAuthSession,
  useServerDeployment,
  useSession
} from '@metorial/state';
import { useEffect, useRef, useState } from 'react';
import { openWindow } from '../../../../lib/openWindows';

export let useSessionForDeployment = (
  instanceId: string | null | undefined,
  deploymentId: string | null | undefined
) => {
  let createSession = useCreateSession(instanceId);
  let createOAuthSession = useCreateOAuthSession(instanceId);
  let getAuthSession = useGetOAuthSession(instanceId);

  let deployment = useServerDeployment(instanceId, deploymentId);
  let [session, setSession] = useState<DashboardInstanceSessionsGetOutput | null>(null);

  let [state, setState] = useState<
    'loading' | 'error' | 'oauth_pending' | 'oauth_error' | 'ready'
  >('loading');

  let creatingSessionRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    (async () => {
      if (!instanceId || !deployment.data || creatingSessionRef.current === deployment.data.id)
        return;
      creatingSessionRef.current = deployment.data.id;

      let oauthSessionIdRef: { current: string | null } = { current: null };

      if (deployment.data!.oauthConnection) {
        setState('oauth_pending');

        let [oauthSession] = await createOAuthSession.mutate({
          connectionId: deployment.data.oauthConnection.id,
          serverDeploymentId: deployment.data.id
        });
        if (!oauthSession) return setState('oauth_error');

        let url = new URL(oauthSession.url);
        url.searchParams.set(
          'metorial_dashboard_payload',
          JSON.stringify({ useClientResponse: true })
        );

        let win = openWindow(url.toString());

        await new Promise<void>((resolve, reject) => {
          let doneRef = { current: false };

          setTimeout(() => {
            let countRef = { current: 0 };

            let task = async () => {
              if (countRef.current++ > 60) return reject();

              let [res] = await getAuthSession.mutate({ sessionId: oauthSession.id });
              if (res?.status == 'completed') {
                oauthSessionIdRef.current = oauthSession.id;
                doneRef.current = true;
                resolve();
                win.close();
                return;
              }

              setTimeout(task, Math.min(1000 * 2 ** countRef.current, 7000));
            };

            task();
          }, 5000);

          win.onClose(() => {
            if (doneRef.current) return;
            setTimeout(() => setState('oauth_error'), 100);
          });

          win.onMessage(msg => {
            if (msg.data?.type === 'oauth_complete') {
              oauthSessionIdRef.current = oauthSession.id;
              doneRef.current = true;
              resolve();
              win.close();
            }
          });
        });
      }

      createSession
        .mutate({
          serverDeployments: [
            {
              serverDeploymentId: deployment.data.id,
              oauthSessionId: oauthSessionIdRef.current ?? undefined
            }
          ]
        })
        .then(([res, error]) => {
          if (res) {
            setSession(res);
            setState('ready');
          }
        });
    })().catch(() => {
      setState('error');
    });
  }, [instanceId, deployment.data?.id]);

  let sessionGetter = useSession(instanceId, session?.id);

  return {
    ...sessionGetter,
    data: sessionGetter.data ?? session,
    error:
      sessionGetter.error ??
      createSession.error ??
      createOAuthSession.error ??
      deployment.error,
    isLoading: sessionGetter.isLoading || state === 'loading',
    state
  };
};
