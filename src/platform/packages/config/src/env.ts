import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';
import { metorialEnv, publicUrls, redisUrl } from '@metorial/shared-settings';

export let serviceSettings = defineSettings('service', { redisUrl });

export let urlSettings = defineSettings('urls', publicUrls);

export let environmentSettings = defineSettings('environment', { environment: metorialEnv });

export let encryptionSettings = defineSettings('encryption', {
  secret: setting(v.string(), { env: 'ENCRYPTION_SECRET', audience: 'deployment' })
});
