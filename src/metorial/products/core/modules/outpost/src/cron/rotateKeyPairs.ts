import { createCron } from '@metorial/cron';
import { combineQueueProcessors } from '@metorial/queue';
import { outpostTokenKeyPairService } from '../services/outpostTokenKeyPair';

let rotateCron = createCron(
  { name: 'outp/tokenKeyPair/rotate', cron: '* * * * *' },
  async () => {
    await outpostTokenKeyPairService.demoteElapsedKeyPairs({});
  }
);

export let rotateOutpostTokenKeyPairsProcessors = combineQueueProcessors([rotateCron]);
