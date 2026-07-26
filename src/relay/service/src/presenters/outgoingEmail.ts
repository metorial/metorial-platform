import type {
  OutgoingEmail,
  OutgoingEmailAttachment,
  OutgoingEmailDestination,
  OutgoingEmailSend
} from '../../prisma/generated/client';

type PresentedOutgoingEmail = OutgoingEmail & {
  destinations: (OutgoingEmailDestination & {
    OutgoingEmailSend: OutgoingEmailSend[];
  })[];
  attachments: Pick<
    OutgoingEmailAttachment,
    'id' | 'filename' | 'contentType' | 'disposition' | 'contentId' | 'size'
  >[];
};

let getStatus = (email: PresentedOutgoingEmail) => {
  if (
    email.destinations.length > 0 &&
    email.destinations.every(item => item.status == 'sent')
  ) {
    return 'sent' as const;
  }
  if (
    email.destinations.length > 0 &&
    email.destinations.every(item => item.status == 'sent' || item.status == 'failed') &&
    email.destinations.some(item => item.status == 'failed')
  ) {
    return 'failed' as const;
  }
  if (email.destinations.some(item => item.status == 'retry')) return 'retry' as const;
  return 'pending' as const;
};

export let outgoingEmailPresenter = (email: PresentedOutgoingEmail) => ({
  object: 'relay#outgoing_email',
  id: email.id,
  status: getStatus(email),
  subject: email.subject,
  fromName: email.fromName,
  replyTo: email.replyTo,
  idempotencyKey: email.idempotencyKey,
  numberOfDestinations: email.numberOfDestinations,
  numberOfDestinationsCompleted: email.numberOfDestinationsCompleted,
  destinations: email.destinations.map(destination => ({
    destination: destination.destination,
    status: destination.status,
    messageId: destination.OutgoingEmailSend[0]?.messageId ?? null,
    lastAttemptAt: destination.OutgoingEmailSend[0]?.createdAt ?? null
  })),
  attachments: email.attachments.map(attachment => ({
    filename: attachment.filename,
    contentType: attachment.contentType,
    disposition: attachment.disposition,
    contentId: attachment.contentId,
    size: attachment.size
  })),
  createdAt: email.createdAt
});
