import { CustomServerVersion, db, ID, RemoteServerInstance } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getAxiosSsrfFilter } from '@metorial/ssrf';
import axios from 'axios';

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

  try {
    await axios.get(remote.remoteUrl, {
      validateStatus: status => status < 500,
      headers: {
        'User-Agent': 'Metorial (https://metorial.com)'
      },
      ...getAxiosSsrfFilter(remote.remoteUrl),
      maxRedirects: 5
    });

    return { ok: true };
  } catch (error: any) {
    let userFacingMessage = 'Metorial could not connect to the remote server.';
    if (error.response) {
      userFacingMessage = `Metorial could not connect to the remote server. Status: ${error.response.status} - ${error.response.statusText}`;
    }

    if (opts.createEvent) {
      await db.customServerEvent.create({
        data: {
          id: await ID.generateId('customServerEvent'),

          customServerOid: remote.customServerVersion.customServerOid,
          customServerVersionOid: remote.customServerVersion.oid,

          sourceInstanceOid: remote.instanceOid,

          type: 'remote_connection_issue',
          message: userFacingMessage,
          payload: {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          }
        }
      });
    }

    return { ok: false, error: userFacingMessage };
  }
};
