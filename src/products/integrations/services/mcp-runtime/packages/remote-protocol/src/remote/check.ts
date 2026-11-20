import {
  axiosWithoutSse,
  forceHttpsRedirect,
  getAxiosEgressOptions,
  type EgressContext
} from '@mtsrc/mcp-runtime-network';

export let checkRemote = async (remoteUrl: string, egress: EgressContext) => {
  let getRes = await checkRemoteInner({
    remoteUrl,
    egress,
    method: 'GET'
  });
  if (getRes.ok) return getRes;

  let postRes = await checkRemoteInner({
    remoteUrl,
    egress,
    method: 'POST'
  });
  return postRes;
};

let checkRemoteInner = async (d: {
  remoteUrl: string;
  egress: EgressContext;
  method: 'GET' | 'POST';
}) => {
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
      ...getAxiosEgressOptions(d.remoteUrl, d.egress)
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
