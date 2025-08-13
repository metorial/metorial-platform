import { db, ID } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import axios from 'axios';

export let checkRemoteQueue = createQueue<{ remoteId: string }>({
  name: 'rmsr/ckRem'
});

export let checkRemoteQueueProcessor = checkRemoteQueue.process(async data => {
  let remote = await db.remoteServerInstance.findFirst({
    where: { id: data.remoteId }
  });
  if (!remote) return;

  try {
    await axios.get(remote.remoteUrl, {
      validateStatus: status => status < 500,
      headers: {
        'User-Agent': 'Metorial (https://metorial.com)'
      }
    });

    // All good
  } catch (error: any) {
    let userFacingMessage = 'Metorial could not connect to the remote server.';
    if (error.response) {
      userFacingMessage = `Metorial could not connect to the remote server. Status: ${error.response.status} - ${error.response.statusText}`;
    }

    await db.remoteServerInstanceNotification.create({
      data: {
        id: await ID.generateId('remoteServerInstanceNotification'),
        remoteServerInstanceOid: remote.oid,
        type: 'connection_issue',
        message: userFacingMessage,
        payload: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        }
      }
    });
  }
});
