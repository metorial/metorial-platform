import { createCron } from '@metorial/cron';
import { oauthJwkService } from '../services/oauthJwk';

export let oauthJwkRotationCron = createCron(
  {
    name: 'macc/oauthJwk/rotate',
    cron: '17 3 * * *'
  },
  async () => {
    await oauthJwkService.rotateOAuthJwks({
      withJitter: true
    });
  }
);

oauthJwkService.rotateOAuthJwks({}).catch(error => {
  console.error('Failed to rotate OAuth JWKs', error);
});
