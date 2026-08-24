import type {
  Slate,
  SlateAuthConfig,
  SlateAuthMethod,
  SlateInstance,
  SlateInstanceConfig,
  SlateOAuthCredentials,
  SlateTriggerGroup,
  SlateWebhookRegistration,
  SlateWebhookRegistrationAuthMethod,
  SlateWebhookRegistrationOAuthCredentials
} from '../../prisma/generated/client';
import { getWebhookUrl } from '../lib/webhookUrl';

export let slateWebhookRegistrationPresenter = (
  registration: SlateWebhookRegistration & {
    instance: SlateInstance | null;
    instanceConfig: SlateInstanceConfig | null;
    authConfig: SlateAuthConfig | null;
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

  slateInstanceId: registration.instance?.id ?? null,
  slateInstanceConfigId: registration.instanceConfig?.id ?? null,
  slateAuthConfigId: registration.authConfig?.id ?? null,

  authRouting: registration.authRouting,
  authMethodIds: registration.authMethods.map(m => m.authMethod.id),
  slateOAuthCredentialsIds: registration.oauthCredentials.map(c => c.oauthCredentials.id),

  createdAt: registration.createdAt,
  updatedAt: registration.updatedAt
});
