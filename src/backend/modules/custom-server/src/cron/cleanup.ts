import { createCron } from '@metorial/cron';
import { subDays } from 'date-fns';

export let customServerCleanupCron = createCron(
  {
    name: 'csrv/cleanup',
    cron: '0 0 * * *'
  },
  async () => {
    let twoWeeksAgo = subDays(new Date(), 14);
    let oneMonthAgo = subDays(new Date(), 30);
  }
);
