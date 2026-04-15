import { normalizeEmail } from './normalizeEmail';

export let parseEmail = (emailRaw: string) => {
  let email = emailRaw.toLowerCase().trim();
  let [local, domain] = email.split('@');

  if (!local || !domain) {
    throw new Error('Invalid email');
  }

  return {
    email,
    domain,
    normalizedEmail: normalizeEmail(email)
  };
};
