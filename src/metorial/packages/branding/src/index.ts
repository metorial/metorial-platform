import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting, type ResolvedGroups } from '@metorial/settings';

type AssetDefault = string | ((resolved: ResolvedGroups) => string);

let onPremAssetUrl = (resolved: ResolvedGroups, path: string) =>
  `${resolved.urls!.APP_URL ?? 'http://localhost'}/assets${path}`;

let settings = defineSettings({
  urls: {
    APP_URL: v.optional(v.string())
  },

  assets: {
    ASSETS_BASE_URL: setting(v.string(), {
      default: perEdition<AssetDefault>({
        cloud: 'https://cdn.metorial.com',
        'on-prem': resolved => onPremAssetUrl(resolved, '')
      })
    }),

    AVATAR_BASE_URL: setting(v.string(), {
      default: perEdition<AssetDefault>({
        cloud: 'https://avatar-cdn.metorial.com',
        'on-prem': resolved => onPremAssetUrl(resolved, '/avatars')
      })
    }),

    METORIAL_LOGO_URL: setting(v.string(), {
      default: perEdition<AssetDefault>({
        cloud:
          'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg',
        'on-prem': resolved => onPremAssetUrl(resolved, '/logos/metorial/primary_logo/raw.svg')
      })
    }),

    METORIAL_MONO_LOGO_URL: setting(v.string(), {
      default: perEdition<AssetDefault>({
        cloud: 'https://cdn.metorial.com/metorial-bw.svg',
        'on-prem': resolved => onPremAssetUrl(resolved, '/metorial-bw.svg')
      })
    })
  }
});

export let branding = {
  assetsBaseUrl: settings.assets.ASSETS_BASE_URL,
  logoUrl: settings.assets.METORIAL_LOGO_URL,
  monoLogoUrl: settings.assets.METORIAL_MONO_LOGO_URL,

  avatarUrl: (id: string) => `${settings.assets.AVATAR_BASE_URL}/${id}`
};
