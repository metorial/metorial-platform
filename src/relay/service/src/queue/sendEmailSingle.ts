import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import type {
  OutgoingEmailDestination,
  OutgoingEmailSendStatus
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { snowflake } from '../id';
import { send } from '../lib/send';

let Sentry = getSentry();

export let sendEmailSingleQueue = createQueue<{ destinationId: bigint }>({
  name: 'fed/email/send_email_single',
  redisUrl: env.service.REDIS_URL,
  jobOpts: {
    attempts: 10,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  },
  workerOpts: {
    limiter: {
      duration: 60 * 1000,
      max: 50
    }
  }
});

export let sendEmailSingleQueueProcessor = sendEmailSingleQueue.process(async data => {
  let destination = await db.outgoingEmailDestination.findFirst({
    where: {
      id: data.destinationId,
      status: {
        in: ['pending', 'retry']
      }
    },
    include: {
      email: {
        include: {
          content: true,
          identity: true
        }
      }
    }
  });
  let email = destination?.email;
  if (!destination || !email?.content) throw new QueueRetryError();

  let sendRes: any;
  let status: OutgoingEmailSendStatus = 'success';

  try {
    sendRes = await send({
      to: destination.destination,
      subject: email.content.subject,
      html: email.content.html.replaceAll('EMAIL_ID', email.id),
      text: email.content.text.replaceAll('EMAIL_ID', email.id),
      identity: email.identity
    });
  } catch (err) {
    Sentry.captureException(err);
    status = 'failed';
    sendRes = JSON.stringify(err);
  }

  await db.outgoingEmailSend.create({
    data: {
      id: snowflake.nextId(),
      destinationId: destination.id,
      status,
      result: sendRes
    }
  });

  let sendCount = await db.outgoingEmailSend.count({
    where: { destinationId: destination.id }
  });

  let updatedDest: OutgoingEmailDestination;

  if (sendCount > 5 && status == 'failed') {
    updatedDest = await db.outgoingEmailDestination.update({
      where: { id: destination.id },
      data: { status: 'failed' }
    });
  } else if (status == 'failed') {
    updatedDest = await db.outgoingEmailDestination.update({
      where: { id: destination.id },
      data: { status: 'retry' }
    });

    await sendEmailSingleQueue.add(
      { destinationId: destination.id },
      { delay: 1000 * 60 * 5 }
    );
  } else {
    updatedDest = await db.outgoingEmailDestination.update({
      where: { id: destination.id },
      data: { status: 'sent' }
    });
  }

  if (updatedDest.status != 'retry') {
    let email = await db.outgoingEmail.update({
      where: { oid: destination.emailId },
      data: {
        numberOfDestinationsCompleted: {
          increment: 1
        }
      }
    });

    // Get rid of the email content if all destinations have been sent
    // This is to save space in the database
    if (email.numberOfDestinations >= email.numberOfDestinationsCompleted) {
      await db.outgoingEmailContent.deleteMany({
        where: { emailId: email.oid }
      });
    }
  }
});
