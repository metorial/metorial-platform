import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';

export let env = defineSettings({
  images: {
    IMAGE_ALLOWED_HOSTS: setting.list(v.string(), {
      default: perEdition({
        cloud: [
          'metorial.com',
          'metorial.net',
          'metorial-cdn.com',
          'metorial-files.com',
          'localhost'
        ],
        'on-prem': ['localhost']
      })
    })
  }
});
