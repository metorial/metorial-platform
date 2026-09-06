import { env } from '../env';

export let getWebhookUrl = (registration: { urlKey: string }) => {
  let host = env.slates.SLATES_WEBHOOK_TRIGGER_HOST || env.service.SERVICE_PUBLIC_URL;
  return `${host}/receive/${registration.urlKey}`;
};
