import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { sendEmailSingleQueue } from './sendEmailSingle';

export let sendEmailQueue = createQueue<{ emailId: string }>({
  name: 'email/send_email',
  jobOpts: {
    attempts: 10
  },
  workerOpts: {
    limiter: {
      duration: 60 * 1000,
      max: 50
    }
  }
});

export let sendEmailQueueProcessor = sendEmailQueue.process(async data => {
  let email = await db.outgoingEmail.findFirst({
    where: {
      id: data.emailId
    },
    include: {
      destinations: true
    }
  });
  if (!email) return;

  await sendEmailSingleQueue.addMany(
    email.destinations.map(d => ({
      destinationId: d.id
    }))
  );
});
