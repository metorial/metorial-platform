import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookEvent,
  SlateWebhookRegistration,
  Tenant,
  TriggerWebhookTarget
} from '../../prisma/generated/client';
import { getLocalhostWebhookUrl, getWebhookUrl } from '../lib/webhookUrl';
import { slateWebhookEventPresenter } from './slateWebhookEvent';

export let adminWebhookTriggerPresenter = (
  registration: SlateWebhookRegistration & {
    slate: Slate;
    triggerGroup: SlateTriggerGroup;
    tenant: Tenant | null;
    triggerWebhookTarget: TriggerWebhookTarget | null;
  }
) => ({
  object: 'webhook_trigger',

  id: registration.id,
  type: registration.type,
  owner: registration.owner,
  status: registration.status,

  name: registration.name,
  description: registration.description,
  metadata: registration.metadata ?? {},

  urlKey: registration.urlKey,
  receiveUrl: getWebhookUrl(registration),
  localhostReceiveUrl: getLocalhostWebhookUrl(registration),

  tenant: registration.tenant
    ? {
        id: registration.tenant.id,
        name: registration.tenant.name,
        identifier: registration.tenant.identifier
      }
    : null,

  slate: {
    id: registration.slate.id,
    name: registration.slate.name,
    identifier: registration.slate.identifier
  },

  triggerGroup: {
    id: registration.triggerGroup.id,
    name: registration.triggerGroup.name,
    key: registration.triggerGroup.key
  },

  webhookTarget: registration.triggerWebhookTarget
    ? {
        id: registration.triggerWebhookTarget.id,
        name: registration.triggerWebhookTarget.name,
        targetIdentifier: registration.triggerWebhookTarget.targetIdentifier,
        status: registration.triggerWebhookTarget.status
      }
    : null,

  authRouting: registration.authRouting,

  createdAt: registration.createdAt,
  updatedAt: registration.updatedAt
});

export let adminWebhookEventPresenter = async (
  event: SlateWebhookEvent & {
    webhookRegistration: SlateWebhookRegistration & {
      slate: Slate;
      triggerGroup: SlateTriggerGroup;
    };
  }
) => {
  let inner = await slateWebhookEventPresenter(event);
  return {
    ...inner,
    responseOverride: event.responseOverride ?? null
  };
};
