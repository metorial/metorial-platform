import { EventObject, eventObjectAction } from '@lowerdeck/event';
import type { User } from '../../prisma/generated/client';
import { env } from '../env';

let NAME = 'ares/user';

export let userEventObject = eventObjectAction<User>({
  type: NAME
});

export let userEvents = new EventObject({
  objectName: NAME,
  serviceName: 'auth',
  redisUrl: env.service.REDIS_URL
})
  .action(userEventObject('create'))
  .action(userEventObject('update'))
  .action(userEventObject('delete'));
