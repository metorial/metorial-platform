import type { SlateInstanceOAuthSetup } from '@mtsrc/slates-hub-db/client';
import { env } from '@mtsrc/slates-hub-env/env';

export let presentSetupError = (
  setup: Pick<SlateInstanceOAuthSetup, 'errorCode' | 'errorMessage'>
) => {
  let message = setup.errorMessage ?? setup.errorCode;

  return message ? { code: setup.errorCode ?? 'oauth_error', message } : null;
};

export let presentSetupUrl = (
  setup: Pick<SlateInstanceOAuthSetup, 'id' | 'status' | 'isAdminSetup'>
) => {
  if (setup.status === 'completed') return null;
  if (setup.isAdminSetup && setup.status === 'failed') return null;

  return `${env.service.SERVICE_PUBLIC_URL}/slates-hub/authorization?setup_id=${setup.id}`;
};
