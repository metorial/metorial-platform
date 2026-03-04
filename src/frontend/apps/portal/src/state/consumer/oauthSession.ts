import {
  ProviderOauthSessionsCreateBody,
  ProviderOauthSessionsListQuery
} from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { delay } from '@lowerdeck/delay';
import { useMemo } from 'react';
import { openWindow } from '../../lib/openWindows';
import { usePaginator } from '../lib/usePaginator';
import { withSdk } from './client';

export let oauthSessionsLoader = createLoader({
  name: 'oauthSessions',
  parents: [],
  fetch: (i: ProviderOauthSessionsListQuery) => withSdk(sdk => sdk.oauthSessions.list(i)),
  mutators: {}
});

export let useOAuthSessions = (query?: ProviderOauthSessionsListQuery) => {
  const data = usePaginator(pagination =>
    oauthSessionsLoader.use({ ...pagination, ...query })
  );

  return data;
};

export let oauthSessionLoader = createLoader({
  name: 'oauthSession',
  parents: [],
  fetch: (i: { sessionId: string }) => withSdk(sdk => sdk.oauthSessions.get(i.sessionId)),
  mutators: {}
});

export let useOAuthSession = (sessionId: string | null | undefined) => {
  let data = oauthSessionLoader.use(sessionId ? { sessionId } : null);

  return data;
};

export let useCreateOAuthSession = () => {
  return useMutation(
    useMemo(
      () => (body: ProviderOauthSessionsCreateBody) =>
        withSdk(sdk => sdk.oauthSessions.create(body)),
      []
    ),
    { disableToast: true }
  );
};

export let useGetOAuthSession = () => {
  return useMutation(
    useMemo(
      () => (input: { sessionId: string }) =>
        withSdk(sdk => sdk.oauthSessions.get(input.sessionId)),
      []
    ),
    { disableToast: true }
  );
};

export let createOAuthSession = (body: ProviderOauthSessionsCreateBody) =>
  withSdk(sdk => sdk.oauthSessions.create(body));

export let getOAuthSession = (input: { sessionId: string }) =>
  withSdk(sdk => sdk.oauthSessions.get(input.sessionId));

export let authenticateWithOauth = async (d: {
  serverDeploymentId: string;
  onClose?: () => void;
}) => {
  let oauthSessionIdRef: { current: string | null } = { current: null };

  let oauthSession = await createOAuthSession({
    serverDeploymentId: d.serverDeploymentId
  });

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

        let res = await getOAuthSession({
          sessionId: oauthSession.id
        });
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
      setTimeout(() => d.onClose?.(), 100);
    });

    win.onMessage(async msg => {
      if (msg.data?.type === 'oauth_complete') {
        await delay(200);
        oauthSessionIdRef.current = oauthSession.id;
        doneRef.current = true;
        resolve();
        win.close();
      }
    });
  });

  return oauthSessionIdRef.current!;
};
