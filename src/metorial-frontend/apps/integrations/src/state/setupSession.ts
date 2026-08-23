import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef, useState } from 'react';
import { getIntegrationsClient } from './client';

export let setupSessionState = createLoader({
  name: 'setupSession',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    getIntegrationsClient(d.clientSecret).setupSession.get({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {}
});

export let authConfigSchemaState = createLoader({
  name: 'authConfigSchema',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    getIntegrationsClient(d.clientSecret).setupSession.getAuthConfigSchema({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {}
});

export let configSchemaState = createLoader({
  name: 'configSchema',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    getIntegrationsClient(d.clientSecret).setupSession.getConfigSchema({
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
    getIntegrationsClient(d.clientSecret).setupSession.listProviders({
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
    getIntegrationsClient(d.clientSecret).integrationSetupSession.get({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {
    startStep: (
      i: { stepId: string },
      d: { input: { sessionId: string; clientSecret: string } }
    ) =>
      getIntegrationsClient(d.input.clientSecret).integrationSetupSession.startStep({
        sessionId: d.input.sessionId,
        clientSecret: d.input.clientSecret,
        stepId: i.stepId
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
  return setupSessionState.use(getInputFromUrl());
};

export let useIntegrationSetupSession = () => {
  return integrationSetupSessionState.use(getIntegrationInputFromUrl());
};
