import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { sendAuthCodeEmail } from '../email/code';

export let authCodeQueue = createQueue<{
  codeId: string;
}>({
  name: 'cmr/athcd'
});

export let authCodeQueueProcessor = authCodeQueue.process(async data => {
  let authCode = await db.consumerAuthCode.findUnique({
    where: { id: data.codeId },
    include: { factor: { include: { consumerSurface: true } } }
  });
  if (!authCode) throw new QueueRetryError();

  await sendAuthCodeEmail.send({
    data: {
      code: authCode.code,
      surfaceName: authCode.factor.consumerSurface.name
    },
    to: [authCode.email]
  });
});
