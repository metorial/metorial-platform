import { createLock } from '@lowerdeck/lock';
import { env } from '../env';

let chatMessageLock = createLock({
  name: 'sub/chat/message/lock',
  redisUrl: env.service.REDIS_URL
});

export let usingChatMessageLock = <T>(chatOid: bigint, fn: () => Promise<T>) =>
  chatMessageLock.usingLock(chatOid.toString(), fn);
