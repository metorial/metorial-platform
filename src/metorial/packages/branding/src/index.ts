import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';
import { installationSettings } from '@metorial/shared-settings';

type AssetDefault = string | (() => string);

let onPremAssetUrl = (path: string) => `${installationSettings().publicUrl}/assets${path}`;

let assets = defineSettings('assets', {
  baseUrl: setting(v.string(), {
    env: 'ASSETS_BASE_URL',
    audience: 'derived',
    description: 'Base URL the built-in logos and images are served from',
    default: perEdition<AssetDefault>({
      cloud: 'https://cdn.metorial.com',
      'on-prem': () => onPremAssetUrl('')
    })
  }),

  avatarBaseUrl: setting(v.string(), {
    env: 'AVATAR_BASE_URL',
    audience: 'derived',
    default: perEdition<AssetDefault>({
      cloud: 'https://avatar-cdn.metorial.com',
      'on-prem': () => onPremAssetUrl('/avatars')
    })
  }),

  logoUrl: setting(v.string(), {
    env: 'METORIAL_LOGO_URL',
    audience: 'derived',
    default: perEdition<AssetDefault>({
      cloud:
        'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg',
      'on-prem': () => onPremAssetUrl('/logos/metorial/primary_logo/raw.svg')
    })
  }),

  monoLogoUrl: setting(v.string(), {
    env: 'METORIAL_MONO_LOGO_URL',
    audience: 'derived',
    default: perEdition<AssetDefault>({
      cloud: 'https://cdn.metorial.com/metorial-bw.svg',
      'on-prem': () => onPremAssetUrl('/metorial-bw.svg')
    })
  })
});

export let branding = {
  assetsBaseUrl: assets.baseUrl,
  logoUrl: assets.logoUrl,
  monoLogoUrl: assets.monoLogoUrl,

  avatarUrl: (id: string) => `${assets.avatarBaseUrl}/${id}`
};
