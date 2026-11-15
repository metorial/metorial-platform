import { oauthAuthorizationService } from '@metorial/module-machine-access';

export let ensureOptionalClientSecretIsValid = async (d: {
  clientId: string;
  clientSecret?: string;
}) => {
  if (!d.clientSecret) return;

  await oauthAuthorizationService.getOAuthApplicationByClientId({
    clientId: d.clientId,
    clientSecret: d.clientSecret
  });
};
