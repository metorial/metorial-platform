import type {
  Slate,
  SlateAuthMethod,
  SlateOAuthCredentials,
  SlateTriggerGroup,
  SlateWebhookRegistration,
  SlateWebhookRegistrationAuthMethod,
  SlateWebhookRegistrationOAuthCredentials
} from '../../prisma/generated/client';
import { getWebhookUrl } from '../lib/webhookUrl';

export let slateWebhookRegistrationPresenter = (
  registration: SlateWebhookRegistration & {
    slate: Slate;
    triggerGroup: SlateTriggerGroup;
    authMethods: (SlateWebhookRegistrationAuthMethod & { authMethod: SlateAuthMethod })[];
    oauthCredentials: (SlateWebhookRegistrationOAuthCredentials & {
      oauthCredentials: SlateOAuthCredentials;
    })[];
  }
) => ({
  object: 'slate.webhook_registration',

  id: registration.id,
  type: registration.type,
  owner: registration.owner,
  status: registration.status,

  name: registration.name,
  description: registration.description,
  metadata: registration.metadata ?? {},

  urlKey: registration.urlKey,
  receiveUrl: getWebhookUrl(registration),

  slateId: registration.slate.id,
  triggerGroupId: registration.triggerGroup.id,

  authRouting: registration.authRouting,
  authMethodIds: registration.authMethods.map(m => m.authMethod.id),
  slateOAuthCredentialsIds: registration.oauthCredentials.map(c => c.oauthCredentials.id),

  createdAt: registration.createdAt,
  updatedAt: registration.updatedAt
});
