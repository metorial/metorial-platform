import { getAxiosSsrfFilter } from '../http/axiosSsrf';
import { forceHttpsRedirect } from '../http/forceHttpsRedirect';
import { axiosWithoutSse } from '../http/sse';

export let checkRemote = async (remoteUrl: string) => {
  let getRes = await checkRemoteInner({
    remoteUrl,
    method: 'GET'
  });
  if (getRes.ok) return getRes;

  let postRes = await checkRemoteInner({
    remoteUrl,
    method: 'POST'
  });
  return postRes;
};

let checkRemoteInner = async (d: { remoteUrl: string; method: 'GET' | 'POST' }) => {
  try {
    await axiosWithoutSse(d.remoteUrl, {
      method: d.method,
      validateStatus: status => status < 500,
      headers: {
        'User-Agent': 'Metorial (https://metorial.com)'
      },
      timeout: 5000,
      maxRedirects: 5,
      ignoreSse: true,
      ...forceHttpsRedirect(d.remoteUrl),
      ...getAxiosSsrfFilter(d.remoteUrl)
    });

    return { ok: true as const };
  } catch (error: any) {
    // console.error(`Error during remote server check for URL ${d.remoteUrl}:`, error);

    let userFacingMessage = 'Metorial could not connect to the remote server.';

    return {
      ok: false as const,
      errorMessage: userFacingMessage,
      error: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      }
    };
  }
};
