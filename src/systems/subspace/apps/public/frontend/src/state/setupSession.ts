import { type ErrorData, ServiceError } from '@lowerdeck/error';
import { createLoader } from '@metorial-io/data-hooks';
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

let getInputFromUrl = (): { sessionId: string; clientSecret: string } | null => {
  let match = window.location.pathname.match(/\/setup-session\/([^/?]+)/);
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
