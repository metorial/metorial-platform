import { v } from '@lowerdeck/validation';
import {
  AccessPolicy,
  AccessPolicyAssignment,
  OAuthApplication,
  OAuthApplicationClientSecret,
  Organization,
  ServiceAccount
} from '@metorial/db';
import { serviceAccountPresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let serviceAccountResource = resource({
  name: 'service_account',
  payload: v.typedAny<{
    serviceAccount: ServiceAccount & {
      organization: Organization;
      policies?: (AccessPolicyAssignment & {
        accessPolicy: AccessPolicy;
      })[];
      oauthApplication: OAuthApplication & {
        organization: Organization | null;
        clientSecrets?: OAuthApplicationClientSecret[] | null;
      };
    };
  }>('service_account'),
  presenter: serviceAccountPresenter,
  actions: {
    create: true,
    update: true,
    archive: true
  }
});

export let serviceAccountCredentialResource = resource({
  name: 'service_account_credential',
  payload: v.typedAny<{
    id: string;
    serviceAccount: { id: string; name: string };
    oauthApplication: { id: string; name: string };
  }>('service_account_credential'),
  presenter: undefined,
  actions: {
    create: true
  }
});
