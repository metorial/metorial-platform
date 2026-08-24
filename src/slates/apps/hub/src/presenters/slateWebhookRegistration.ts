import type {
  SlateAuthConfig,
  SlateInstance,
  SlateInstanceConfig,
  SlateWebhookRegistration
} from '../../prisma/generated/client';
import { env } from '../env';

export let slateWebhookRegistrationPresenter = (
  registration: SlateWebhookRegistration & {
    instance: SlateInstance | null;
    instanceConfig: SlateInstanceConfig | null;
    authConfig: SlateAuthConfig | null;
  }
) => ({
  object: 'slate.webhook_registration',

  id: registration.id,
  type: registration.type,
  status: registration.status,

  name: registration.name,
  description: registration.description,
  metadata: registration.metadata ?? {},

  urlKey: registration.urlKey,
  receiveUrl: `${env.service.SERVICE_PUBLIC_URL}/receive/${registration.urlKey}`,

  slateInstanceId: registration.instance?.id ?? null,
  slateInstanceConfigId: registration.instanceConfig?.id ?? null,
  slateAuthConfigId: registration.authConfig?.id ?? null,

  createdAt: registration.createdAt,
  updatedAt: registration.updatedAt
});
