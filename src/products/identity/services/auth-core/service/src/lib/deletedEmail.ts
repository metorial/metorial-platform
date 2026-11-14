import { generatePlainId } from '@lowerdeck/id';

export let deletedEmail = {
  delete: (email: string) => {
    let [local, domain] = email.split('@');

    return JSON.stringify([generatePlainId(20), local, domain]);
  },

  restoreAnonymized: (deletedEmail: string) => {
    if (deletedEmail.includes('@')) return deletedEmail;

    let [id, local, domain] = JSON.parse(deletedEmail);
    let localAnon = local.substring(0, 2) + '...';

    return `${localAnon}@${domain}`;
  }
};
