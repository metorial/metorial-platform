import { db } from '@mtsrc/auth-core-db';
import { getId } from '@mtsrc/auth-core-db';

let ensureUserTermsType = (d: { identifier: string; version: string; name: string }) =>
  db.userTermsType.upsert({
    where: { identifier_version: { identifier: d.identifier, version: d.version } },
    create: {
      ...getId('userTermsType'),
      ...d
    },
    update: {
      version: d.version,
      name: d.name
    }
  });

export let terms = {
  privacyPolicy: ensureUserTermsType({
    identifier: 'privacy_policy',
    version: '2025-01-01',
    name: 'Privacy Policy'
  }),
  termsOfService: ensureUserTermsType({
    identifier: 'terms_of_service',
    version: '2025-01-01',
    name: 'Terms of Service'
  })
};
