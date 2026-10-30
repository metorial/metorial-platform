import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';

export let env = defineSettings({
  hosts: {
    PUBLIC_HOST_REWRITE_SUFFIXES: setting.list(v.string(), {
      default: perEdition({ cloud: ['.metorial.com'], 'on-prem': [] })
    })
  }
});
