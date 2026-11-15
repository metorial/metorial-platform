import type { EmailIdentity, Sender } from '../../prisma/generated/client';

export let emailIdentityPresenter = (
  emailIdentity: EmailIdentity & {
    sender: Sender;
  }
) => ({
  object: 'relay#email_identity',

  id: emailIdentity.id,

  type: emailIdentity.type,

  slug: emailIdentity.slug,
  fromName: emailIdentity.fromName,
  fromEmail: emailIdentity.fromEmail,
  senderOid: emailIdentity.senderOid,

  createdAt: emailIdentity.createdAt
});
