import { normalizeEmail } from './normalizeEmail';

export let parseEmail = (emailRaw: string) => {
  let email = emailRaw.toLowerCase().trim();
  let parts = email.split('@');

  if (parts.length != 2) throw new Error('Invalid email');

  let [local, domain] = parts;

  if (!local || !domain || /\s/.test(email)) {
    throw new Error('Invalid email');
  }

  return {
    email,
    domain,
    normalizedEmail: normalizeEmail(email)
  };
};
