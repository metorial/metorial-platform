import { delay } from '@lowerdeck/delay';
import {
  DashboardInstanceProviderDeploymentsSetupSessionsCreateBody,
  DashboardInstanceProviderDeploymentsSetupSessionsGetOutput
} from '@metorial/dashboard-sdk';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { useMemo } from 'react';
import { withAuth } from '../../user';

type ProviderSetupSessionCreateInput = Omit<
  DashboardInstanceProviderDeploymentsSetupSessionsCreateBody,
  'providerId' | 'providerDeploymentId'
> & { providerDeploymentId?: string };

export let providerSetupSessionLoader = createLoader({
  name: 'providerSetupSession',
  parents: [],
  fetch: (i: { instanceId: string; setupSessionId: string }) =>
    withAuth(sdk => sdk.providerDeployments.setupSessions.get(i.instanceId, i.setupSessionId)),
  mutators: {}
});

export let useProviderSetupSession = (
  instanceId: string | null | undefined,
  setupSessionId: string | null | undefined
) => {
  let data = providerSetupSessionLoader.use(
    instanceId && setupSessionId ? { instanceId, setupSessionId } : null
  );

  return data;
};

export let useCreateProviderSetupSession = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined,
  providerDeploymentId?: string | null | undefined
) => {
  return useMutation(
    useMemo(
      () => (body: ProviderSetupSessionCreateInput) => {
        if (!instanceId || !providerId) {
          throw new Error('Missing required setup session context');
        }

        return withAuth(sdk =>
          sdk.providerDeployments.setupSessions.create(instanceId, {
            ...body,
            providerId,
            providerDeploymentId:
              body.providerDeploymentId ?? providerDeploymentId ?? undefined
          })
        );
      },
      [instanceId, providerId, providerDeploymentId]
    ),
    { disableToast: true }
  );
};

export let useGetProviderSetupSession = (instanceId: string | null | undefined) => {
  return useMutation(
    useMemo(
      () => (input: { setupSessionId: string }) =>
        withAuth(sdk =>
          sdk.providerDeployments.setupSessions.get(instanceId!, input.setupSessionId)
        ),
      [instanceId]
    ),
    { disableToast: true }
  );
};

export let createProviderSetupSession = (input: {
  instanceId: string;
  providerId: string;
  providerDeploymentId?: string;
  body: ProviderSetupSessionCreateInput;
}) =>
  withAuth(sdk =>
    sdk.providerDeployments.setupSessions.create(input.instanceId, {
      ...input.body,
      providerId: input.providerId,
      providerDeploymentId: input.body.providerDeploymentId ?? input.providerDeploymentId
    })
  );

export let getProviderSetupSession = (input: { instanceId: string; setupSessionId: string }) =>
  withAuth(sdk =>
    sdk.providerDeployments.setupSessions.get(input.instanceId, input.setupSessionId)
  );

export let authenticateWithSetupSession = async (d: {
  instanceId: string;
  providerId: string;
  deploymentId?: string;
  providerAuthMethodId: string;
  providerAuthCredentialsId?: string;
  openWindow: (url: string) => {
    close: () => void;
    onClose: (cb: () => void) => () => void;
    onMessage: (cb: (e: MessageEvent) => void) => () => void;
  };
  onClose?: () => void;
}): Promise<DashboardInstanceProviderDeploymentsSetupSessionsGetOutput> => {
  let setupSession = await createProviderSetupSession({
    instanceId: d.instanceId,
    providerId: d.providerId,
    providerDeploymentId: d.deploymentId,
    body: {
      providerAuthMethodId: d.providerAuthMethodId,
      providerAuthCredentialsId: d.providerAuthCredentialsId
    }
  });

  if (!setupSession.url) {
    throw new Error('Setup session did not return a URL');
  }

  let url = new URL(setupSession.url);
  url.searchParams.set(
    'metorial_dashboard_payload',
    JSON.stringify({ useClientResponse: true })
  );

  let win = d.openWindow(url.toString());

  return new Promise<DashboardInstanceProviderDeploymentsSetupSessionsGetOutput>(
    (resolve, reject) => {
      let doneRef = { current: false };
      let cleanupClose: (() => void) | undefined;
      let cleanupMessage: (() => void) | undefined;

      let cleanup = () => {
        cleanupClose?.();
        cleanupMessage?.();
      };

      // Start polling after 5 seconds
      setTimeout(() => {
        let countRef = { current: 0 };

        let task = async () => {
          if (doneRef.current) return;
          if (countRef.current++ > 60) {
            cleanup();
            return reject(new Error('OAuth timeout'));
          }

          try {
            let res = await getProviderSetupSession({
              instanceId: d.instanceId,
              setupSessionId: setupSession.id
            });
            if (res?.status === 'completed') {
              doneRef.current = true;
              cleanup();
              win.close();
              resolve(res);
              return;
            }
          } catch {
            // Ignore poll errors, keep trying
          }

          setTimeout(task, Math.min(1000 * 2 ** countRef.current, 7000));
        };

        task();
      }, 5000);

      cleanupClose = win.onClose(() => {
        if (doneRef.current) return;
        setTimeout(() => d.onClose?.(), 100);
      });

      cleanupMessage = win.onMessage(async msg => {
        if (msg.data?.type === 'oauth_complete') {
          await delay(200);

          // Fetch final state
          try {
            let res = await getProviderSetupSession({
              instanceId: d.instanceId,
              setupSessionId: setupSession.id
            });
            doneRef.current = true;
            cleanup();
            win.close();
            resolve(res);
          } catch (err) {
            doneRef.current = true;
            cleanup();
            win.close();
            reject(err);
          }
        }
      });
    }
  );
};
