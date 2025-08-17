import { axiosWithoutSse } from '@metorial/axios-sse';
import { CustomServerVersion, db, ID, RemoteServerInstance } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getAxiosSsrfFilter } from '@metorial/ssrf';

export let checkRemoteQueue = createQueue<{ remoteId: string }>({
  name: 'csrv/ckRem',
  jobOpts: {
    attempts: 10
  }
});

export let checkRemoteQueueProcessor = checkRemoteQueue.process(async data => {
  let remote = await db.remoteServerInstance.findFirst({
    where: { id: data.remoteId },
    include: {
      customServerVersion: true
    }
  });
  if (!remote) return;

  await checkRemote(remote, {
    createEvent: true
  });
});

export let checkRemote = async (
  remote: RemoteServerInstance & {
    customServerVersion: CustomServerVersion | null;
  },
  opts: { createEvent: boolean }
) => {
  if (!remote.customServerVersion)
    throw new Error(`Remote server version not found for remote ID: ${remote.id}`);

  let getRes = await checkRemoteInner({
    remoteUrl: remote.remoteUrl,
    method: 'GET'
  });
  if (getRes.ok) return getRes;

  let postRes = await checkRemoteInner({
    remoteUrl: remote.remoteUrl,
    method: 'POST'
  });
  if (postRes.ok) return postRes;

  if (opts.createEvent) {
    await db.customServerEvent.create({
      data: {
        id: await ID.generateId('customServerEvent'),

        customServerOid: remote.customServerVersion.customServerOid,
        customServerVersionOid: remote.customServerVersion.oid,

        sourceInstanceOid: remote.instanceOid,

        type: 'remote_connection_issue',
        message: getRes.errorMessage,
        payload: getRes.error
      }
    });
  }

  return getRes;
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
      ...getAxiosSsrfFilter(d.remoteUrl)
    });

    return { ok: true as const };
  } catch (error: any) {
    let userFacingMessage = 'Metorial could not connect to the remote server.';
    if (error.response) {
      userFacingMessage = `Metorial could not connect to the remote server. Status: ${error.response.status} - ${error.response.statusText}`;
    }

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
