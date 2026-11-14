import { createLock } from '@lowerdeck/lock';

let passwordLock = createLock({
  name: 'ares/user-password',
  redisUrl: process.env.REDIS_URL!
});

export let withUserPasswordLock = <T>(userId: string, fn: () => Promise<T>) =>
  passwordLock.usingLock(userId, fn);
