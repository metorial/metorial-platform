import { env } from '../env';

export let getWebhookUrl = (registration: { urlKey: string }) => {
  let host = env.slates.SLATES_WEBHOOK_TRIGGER_HOST || env.service.SERVICE_PUBLIC_URL;
  return `${host}/receive/${registration.urlKey}`;
};

export let getLocalhostWebhookUrl = (registration: { urlKey: string }) => {
  let port = env.service.SLATES_HUB_PUBLIC_PORT ?? 52045;
  return `http://localhost:${port}/receive/${registration.urlKey}`;
};
