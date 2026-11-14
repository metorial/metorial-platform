import { encryptionSettings, environmentSettings, serviceSettings, urlSettings } from './env';
import { MetorialConfig } from './types';

export let defaultConfig: MetorialConfig = {
  redisUrl: serviceSettings.redisUrl,

  env: environmentSettings.environment,

  urls: {
    getInviteUrl: invite => {
      if (invite.type === 'enterprise') {
        return new URL(
          `${urlSettings.appUrl}/join/enterprise/${invite.enterpriseId}/${invite.key}`
        ).toString();
      }

      let url = new URL(`${urlSettings.appUrl}/join?invite_key=${invite.key}`);
      if (invite.email) {
        url.searchParams.set('email', invite.email);
      }

      return url.toString();
    },

    apiUrl: urlSettings.apiUrl,
    filesUrl: urlSettings.filesUrl,
    appUrl: urlSettings.appUrl,
    portalsUrl: urlSettings.portalsUrl,
    publicMcpUrl: urlSettings.publicMcpUrl?.replace(/\/+$/, '') || null
  },

  encryptionSecret: encryptionSettings.secret
};
