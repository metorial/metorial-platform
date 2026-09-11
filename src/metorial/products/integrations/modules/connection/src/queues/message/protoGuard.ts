import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { createProtoGuardRunForMessage } from '../../protoguard';

export let protoGuardMessageQueue = createQueue<{ messageId: string }>({
  name: 'sub/con/msg/pg',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let protoGuardMessageQueueProcessor = protoGuardMessageQueue.process(async data => {
  await createProtoGuardRunForMessage({ messageId: data.messageId });
});
