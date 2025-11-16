import { ConsumerAuthCode } from '@metorial/db';

let redactEmail = (email: string) => {
  let [name, domain] = email.split('@');

  let redactedName =
    name.length <= 2
      ? '*'.repeat(name.length)
      : name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];

  return `${redactedName}@${domain}`;
};

export let authCodePresenter = (code: ConsumerAuthCode) => ({
  object: 'portal#auth_code',

  id: code.id,
  deliveryMethod: code.deliveryMethod,
  redactedEmail: redactEmail(code.email),
  createdAt: code.createdAt,
  expiresAt: code.expiresAt
});
