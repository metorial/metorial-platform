import { type ErrorData, ServiceError } from '@lowerdeck/error';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef, useState } from 'react';
import { htmlDecode } from '../../../src/lib/htmlEncode';
import { client } from './client';

type PreloadData =
  | {
      type: 'error';
      error: ErrorData<string, number>;
    }
  | {
      type: 'data';
      data: Awaited<ReturnType<typeof client.setupSession.get>>;
      input: { sessionId: string; clientSecret: string };
    }
  | {
      type: 'integration_setup_session';
      data: Awaited<ReturnType<typeof client.integrationSetupSession.get>>;
      input: { sessionId: string; clientSecret: string };
    }
  | null;

let getPreloadData = (): PreloadData => {
  let preloadEl = document.querySelector('#preload-data');
  if (!preloadEl?.textContent) return null;
  try {
    return JSON.parse(htmlDecode(preloadEl.textContent)) as PreloadData;
  } catch {
    return null;
  }
};

let PRELOAD = getPreloadData();

export let setupSessionState = createLoader({
  name: 'setupSession',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    client.setupSession.get({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {}
});

export let authConfigSchemaState = createLoader({
  name: 'authConfigSchema',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    client.setupSession.getAuthConfigSchema({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {}
});

export let configSchemaState = createLoader({
  name: 'configSchema',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    client.setupSession.getConfigSchema({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {}
});

export let providerSearchState = createLoader({
  name: 'providerSearch',
  fetch: (d: {
    sessionId: string;
    clientSecret: string;
    search?: string;
    limit?: number;
    after?: string;
    before?: string;
  }) =>
    client.setupSession.listProviders({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret,
      search: d.search,
      limit: d.limit,
      after: d.after,
      before: d.before
    }),
  mutators: {}
});

export let integrationSetupSessionState = createLoader({
  name: 'integrationSetupSession',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    client.integrationSetupSession.get({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {
    startProvider: (
      i: { integrationProviderId: string },
      d: { input: { sessionId: string; clientSecret: string } }
    ) =>
      client.integrationSetupSession.startProvider({
        sessionId: d.input.sessionId,
        clientSecret: d.input.clientSecret,
        integrationProviderId: i.integrationProviderId
      })
  }
});

export let useProviderSearch = (
  input: {
    sessionId: string;
    clientSecret: string;
    search?: string;
    limit?: number;
  } | null
) => {
  let [cursor, setCursor] = useState<{ before?: string; after?: string }>({});
  let resetKey = input
    ? `${input.sessionId}:${input.search ?? ''}:${input.limit ?? 12}`
    : null;
  let previousResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (previousResetKeyRef.current === resetKey) return;
    previousResetKeyRef.current = resetKey;
    setCursor({});
  }, [resetKey]);

  let data = providerSearchState.use(input ? { ...input, ...cursor } : null);
  let dataRef = useRef(data.data);
  dataRef.current = data.data;
  let isInitialLoading = !!input && !data.data && !data.error;

  return {
    ...data,
    isLoading: data.isLoading || isInitialLoading,
    next: () => {
      let lastItem = dataRef.current?.items[dataRef.current.items.length - 1];
      if (lastItem) setCursor({ after: lastItem.id });
    },
    previous: () => {
      let firstItem = dataRef.current?.items[0];
      if (firstItem) setCursor({ before: firstItem.id });
    }
  };
};

let getInputFromUrl = (): { sessionId: string; clientSecret: string } | null => {
  let match = window.location.pathname.match(/\/setup-session\/([^/?]+)/);
  let sessionId = match?.[1];
  let clientSecret = new URLSearchParams(window.location.search).get('client_secret');
  if (sessionId && clientSecret) return { sessionId, clientSecret };
  return null;
};

let getIntegrationInputFromUrl = (): { sessionId: string; clientSecret: string } | null => {
  let match = window.location.pathname.match(/\/integration-setup-session\/([^/?]+)/);
  let sessionId = match?.[1];
  let clientSecret = new URLSearchParams(window.location.search).get('client_secret');
  if (sessionId && clientSecret) return { sessionId, clientSecret };
  return null;
};

export let useSetupSession = () => {
  let input =
    PRELOAD?.type === 'data'
      ? { sessionId: PRELOAD.data.session.id, clientSecret: PRELOAD.input.clientSecret }
      : PRELOAD?.type === 'error'
        ? null
        : getInputFromUrl();

  let data = setupSessionState.use(input);

  if (PRELOAD?.type === 'data' && !data.data && !data.error) data.data = PRELOAD.data;
  if (PRELOAD?.type === 'error' && !data.data && !data.error)
    data.error = ServiceError.fromResponse(PRELOAD.error) as any;

  return data;
};

export let useIntegrationSetupSession = () => {
  let input =
    PRELOAD?.type === 'integration_setup_session'
      ? { sessionId: PRELOAD.data.session.id, clientSecret: PRELOAD.input.clientSecret }
      : PRELOAD?.type === 'error'
        ? null
        : getIntegrationInputFromUrl();

  let data = integrationSetupSessionState.use(input);

  if (PRELOAD?.type === 'integration_setup_session' && !data.data && !data.error)
    data.data = PRELOAD.data;
  if (PRELOAD?.type === 'error' && !data.data && !data.error)
    data.error = ServiceError.fromResponse(PRELOAD.error) as any;

  return data;
};
